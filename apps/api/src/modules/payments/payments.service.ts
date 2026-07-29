import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { Prisma, PaymentRequestStatus, PaymentExceptionType } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { makeReference } from '../../common/utils/reference.util';
import {
  CreatePaymentRequestDto, ApprovePaymentDto, ProcessPaymentDto,
  ConfirmPaymentDto, FailPaymentDto, PaymentQueryDto,
} from './dto/payment-request.dto';

const EPSILON = 0.005;
/** Statuses that still occupy a supplier payment slot for a transaction (duplicate detection). */
const LIVE_PAYMENT_STATUSES: PaymentRequestStatus[] = ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'PAID'];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  // ── CREATE (from an APPROVED transaction) ────────────────────────────────
  async create(dto: CreatePaymentRequestDto, userId: string, organizationId: string) {
    const [transaction, supplier, account] = await Promise.all([
      this.prisma.transaction.findFirst({ where: { id: dto.transactionId, organizationId } }),
      this.prisma.supplier.findFirst({ where: { id: dto.supplierId, organizationId } }),
      this.prisma.operationalAccount.findFirst({ where: { id: dto.operationalAccountId, organizationId } }),
    ]);
    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.status !== 'APPROVED') {
      throw new BadRequestException(
        `A payment request can only be raised for an APPROVED transaction (current: ${transaction.status})`,
      );
    }
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!supplier.isActive) throw new BadRequestException('Supplier is inactive');
    if (!account) throw new NotFoundException('Operational account not found');

    const requestedAmount = dto.requestedAmount ?? Number(transaction.supplierCost);
    if (requestedAmount <= 0) {
      throw new BadRequestException('Requested amount must be greater than zero (set a supplier cost on the transaction)');
    }

    const balance = Number(account.currentBalance);
    const currency = dto.currency || account.currency;

    const created = await this.prisma.paymentRequest.create({
      data: {
        organizationId,
        reference:               makeReference('PR'),
        transactionId:           transaction.id,
        supplierId:              supplier.id,
        operationalAccountId:    account.id,
        requestedAmount,
        currency,
        status:                  'DRAFT',
        accountBalanceAtRequest: balance,
        replenishmentRequired:   balance < requestedAmount,
        dueDate:                 dto.dueDate ? new Date(dto.dueDate) : null,
        createdById:             userId,
      },
    });

    // Duplicate detection: another live payment request already covers this transaction.
    const dupes = await this.prisma.paymentRequest.count({
      where: { transactionId: transaction.id, status: { in: LIVE_PAYMENT_STATUSES }, id: { not: created.id } },
    });
    if (dupes > 0) {
      await this.flagException(organizationId, created.id, 'DUPLICATE_PAYMENT',
        `Transaction ${transaction.reference} already has ${dupes} live payment request(s)`);
    }
    // Currency mismatch against the funding account.
    if (currency !== account.currency) {
      await this.flagException(organizationId, created.id, 'CURRENCY_MISMATCH',
        `Request currency ${currency} differs from account currency ${account.currency}`);
    }

    await this.audit.record({
      userId, action: 'PAYMENT_REQUEST_CREATED', entity: 'PaymentRequest', entityId: created.id,
      newValues: { reference: created.reference, requestedAmount, replenishmentRequired: created.replenishmentRequired },
    });
    this.logger.log(`Payment request ${created.reference} created for txn ${transaction.reference}`);
    return this.serialize(created);
  }

  // ── LIST ─────────────────────────────────────────────────────────────────
  async findAll(organizationId: string, query: PaymentQueryDto) {
    const { page = 1, limit = 20, status, supplierId, transactionId, search } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.PaymentRequestWhereInput = {
      organizationId,
      ...(status        && { status }),
      ...(supplierId    && { supplierId }),
      ...(transactionId && { transactionId }),
      ...(search && {
        OR: [
          { reference: { contains: search, mode: 'insensitive' } },
          { supplier:  { name: { contains: search, mode: 'insensitive' } } },
          { transaction: { reference: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.paymentRequest.findMany({
        where, skip, take: limit,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: {
          supplier:           { select: { id: true, name: true } },
          operationalAccount: { select: { id: true, name: true, currency: true, currentBalance: true } },
          transaction:        { select: { id: true, reference: true, srfNumber: true } },
          _count:             { select: { exceptions: true } },
        },
      }),
      this.prisma.paymentRequest.count({ where }),
    ]);
    return { data: rows.map(r => this.serialize(r)), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, organizationId: string) {
    const pr = await this.prisma.paymentRequest.findFirst({
      where: { id, organizationId },
      include: {
        supplier:           true,
        operationalAccount: true,
        transaction:        { select: { id: true, reference: true, srfNumber: true, status: true, client: { select: { name: true } } } },
        approvedBy:         { select: { id: true, name: true } },
        createdBy:          { select: { id: true, name: true } },
        exceptions:         { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!pr) throw new NotFoundException('Payment request not found');
    return this.serialize(pr);
  }

  // ── WORKFLOW ─────────────────────────────────────────────────────────────
  async submit(id: string, organizationId: string, userId: string) {
    const pr = await this.get(id, organizationId);
    this.assertStatus(pr, ['DRAFT'], 'submit');
    return this.transition(id, 'PENDING_APPROVAL', 'PAYMENT_REQUEST_SUBMITTED', pr, userId);
  }

  /** Approve — requires the funding account to cover the request (balance verified). */
  async approve(id: string, dto: ApprovePaymentDto, organizationId: string, userId: string) {
    const pr = await this.prisma.paymentRequest.findFirst({
      where: { id, organizationId }, include: { operationalAccount: true },
    });
    if (!pr) throw new NotFoundException('Payment request not found');
    this.assertStatus(pr, ['PENDING_APPROVAL'], 'approve');

    const balance = Number(pr.operationalAccount?.currentBalance ?? 0);
    const amount  = Number(pr.requestedAmount);
    if (balance + EPSILON < amount) {
      // Auto-flag the shortfall so it appears in the replenishment queue view.
      await this.prisma.paymentRequest.update({ where: { id }, data: { replenishmentRequired: true } });
      throw new BadRequestException(
        `Insufficient account balance (${balance.toFixed(2)} < ${amount.toFixed(2)}). Replenishment required before approval.`,
      );
    }

    const updated = await this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: 'APPROVED', replenishmentRequired: false,
        approvedById: userId, approvedAt: new Date(), approvalComments: dto.comments,
      },
    });
    await this.audit.record({
      userId, action: 'PAYMENT_REQUEST_APPROVED', entity: 'PaymentRequest', entityId: id,
      oldValues: { status: 'PENDING_APPROVAL' }, newValues: { status: 'APPROVED' },
    });
    return this.serialize(updated);
  }

  /** Process/disburse — deducts the account balance and moves to awaiting confirmation. */
  async process(id: string, dto: ProcessPaymentDto, organizationId: string, userId: string) {
    const pr = await this.prisma.paymentRequest.findFirst({
      where: { id, organizationId }, include: { operationalAccount: true },
    });
    if (!pr) throw new NotFoundException('Payment request not found');
    this.assertStatus(pr, ['APPROVED'], 'process');
    if (!pr.operationalAccount) throw new BadRequestException('No operational account linked to this payment request');

    const paymentAmount = dto.paymentAmount ?? Number(pr.requestedAmount);
    const balance = Number(pr.operationalAccount.currentBalance);
    if (balance + EPSILON < paymentAmount) {
      throw new BadRequestException(
        `Insufficient account balance to disburse (${balance.toFixed(2)} < ${paymentAmount.toFixed(2)}).`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.paymentRequest.update({
        where: { id },
        data: {
          status:                'PROCESSING',
          paymentAmount,
          paymentMethod:         dto.paymentMethod,
          paymentDate:           dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          confirmationReference: dto.confirmationReference,
        },
      }),
      this.prisma.operationalAccount.update({
        where: { id: pr.operationalAccountId! },
        data:  { currentBalance: { decrement: paymentAmount } },
      }),
    ]);

    // Amount-mismatch exceptions.
    const requested = Number(pr.requestedAmount);
    if (paymentAmount > requested + EPSILON) {
      await this.flagException(organizationId, id, 'OVERPAYMENT',
        `Disbursed ${paymentAmount.toFixed(2)} vs requested ${requested.toFixed(2)}`);
    } else if (paymentAmount < requested - EPSILON) {
      await this.flagException(organizationId, id, 'UNDERPAYMENT',
        `Disbursed ${paymentAmount.toFixed(2)} vs requested ${requested.toFixed(2)}`);
    }

    await this.audit.record({
      userId, action: 'PAYMENT_REQUEST_PROCESSED', entity: 'PaymentRequest', entityId: id,
      newValues: { paymentAmount, method: dto.paymentMethod },
    });
    this.logger.log(`Payment ${pr.reference} disbursed ${paymentAmount} from ${pr.operationalAccount.name}`);
    return this.serialize(updated);
  }

  /** Confirm — payment cleared. */
  async confirm(id: string, dto: ConfirmPaymentDto, organizationId: string, userId: string) {
    const pr = await this.get(id, organizationId);
    this.assertStatus(pr, ['PROCESSING'], 'confirm');
    const updated = await this.prisma.paymentRequest.update({
      where: { id },
      data:  { status: 'PAID', confirmationReference: dto.confirmationReference, confirmedAt: new Date() },
    });
    // Any open "missing confirmation" exception is now resolved.
    await this.prisma.paymentException.updateMany({
      where: { paymentRequestId: id, type: 'MISSING_CONFIRMATION', status: 'OPEN' },
      data:  { status: 'RESOLVED', resolvedById: userId, resolvedAt: new Date() },
    });
    await this.audit.record({
      userId, action: 'PAYMENT_REQUEST_CONFIRMED', entity: 'PaymentRequest', entityId: id,
      oldValues: { status: 'PROCESSING' }, newValues: { status: 'PAID' },
    });
    return this.serialize(updated);
  }

  /** Fail — reverses the disbursement back into the account and flags the exception. */
  async fail(id: string, dto: FailPaymentDto, organizationId: string, userId: string) {
    const pr = await this.prisma.paymentRequest.findFirst({ where: { id, organizationId } });
    if (!pr) throw new NotFoundException('Payment request not found');
    this.assertStatus(pr, ['PROCESSING'], 'fail');

    const refund = Number(pr.paymentAmount ?? 0);
    const ops: Prisma.PrismaPromise<any>[] = [
      this.prisma.paymentRequest.update({ where: { id }, data: { status: 'FAILED' } }),
    ];
    if (pr.operationalAccountId && refund > 0) {
      ops.push(this.prisma.operationalAccount.update({
        where: { id: pr.operationalAccountId },
        data:  { currentBalance: { increment: refund } },
      }));
    }
    const [updated] = await this.prisma.$transaction(ops);
    await this.flagException(organizationId, id, 'MISSING_CONFIRMATION', dto.reason || 'Payment marked as failed');
    await this.audit.record({
      userId, action: 'PAYMENT_REQUEST_FAILED', entity: 'PaymentRequest', entityId: id,
      newValues: { refunded: refund, reason: dto.reason },
    });
    return this.serialize(updated);
  }

  async cancel(id: string, organizationId: string, userId: string) {
    const pr = await this.get(id, organizationId);
    this.assertStatus(pr, ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'], 'cancel');
    return this.transition(id, 'CANCELLED', 'PAYMENT_REQUEST_CANCELLED', pr, userId);
  }

  // ── EXCEPTIONS ───────────────────────────────────────────────────────────
  async listExceptions(organizationId: string, status?: string) {
    return this.prisma.paymentException.findMany({
      where: { organizationId, ...(status && { status: status as any }) },
      orderBy: { createdAt: 'desc' },
      include: { paymentRequest: { select: { id: true, reference: true, supplier: { select: { name: true } } } } },
    });
  }

  async resolveException(id: string, organizationId: string, userId: string) {
    const ex = await this.prisma.paymentException.findFirst({ where: { id, organizationId } });
    if (!ex) throw new NotFoundException('Exception not found');
    const updated = await this.prisma.paymentException.update({
      where: { id }, data: { status: 'RESOLVED', resolvedById: userId, resolvedAt: new Date() },
    });
    await this.audit.record({
      userId, action: 'PAYMENT_EXCEPTION_RESOLVED', entity: 'PaymentException', entityId: id,
      oldValues: { status: ex.status }, newValues: { status: 'RESOLVED' },
    });
    return updated;
  }

  // ── DASHBOARD ────────────────────────────────────────────────────────────
  async getDashboard(organizationId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      dueToday, overdue, awaitingConfirmation, failed,
      approvedAgg, outstandingSrfs, accounts, replenishments, openExceptions,
    ] = await Promise.all([
      this.prisma.paymentRequest.count({ where: { organizationId, status: 'APPROVED', dueDate: { gte: today, lt: tomorrow } } }),
      this.prisma.paymentRequest.count({ where: { organizationId, status: 'APPROVED', dueDate: { lt: today } } }),
      this.prisma.paymentRequest.count({ where: { organizationId, status: 'PROCESSING' } }),
      this.prisma.paymentRequest.count({ where: { organizationId, status: 'FAILED' } }),
      this.prisma.paymentRequest.aggregate({ where: { organizationId, status: 'APPROVED' }, _sum: { requestedAmount: true } }),
      this.prisma.paymentRequest.findMany({
        where: { organizationId, status: 'APPROVED' },
        orderBy: { dueDate: 'asc' }, take: 10,
        include: { supplier: { select: { name: true } }, transaction: { select: { srfNumber: true, reference: true } } },
      }),
      this.prisma.operationalAccount.findMany({ where: { organizationId, isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.replenishment.findMany({
        where: { organizationId, status: { in: ['PENDING', 'APPROVED'] } },
        orderBy: { createdAt: 'desc' }, take: 10,
        include: { operationalAccount: { select: { name: true, currency: true } } },
      }),
      this.prisma.paymentException.findMany({
        where: { organizationId, status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 10,
        include: { paymentRequest: { select: { reference: true } } },
      }),
    ]);

    return {
      pendingPayments: { dueToday, overdue, awaitingConfirmation, failed },
      totalPendingDisbursement: Number(approvedAgg._sum.requestedAmount ?? 0),
      outstandingSrfs: outstandingSrfs.map(p => this.serialize(p)),
      accountBalances: accounts.map(a => ({
        id: a.id, name: a.name, bankName: a.bankName, currency: a.currency,
        currentBalance: Number(a.currentBalance), minimumBalance: Number(a.minimumBalance),
        belowMinimum: Number(a.currentBalance) < Number(a.minimumBalance),
      })),
      replenishmentRequests: replenishments.map(r => ({
        ...r, requiredAmount: Number(r.requiredAmount), requestedAmount: Number(r.requestedAmount),
        approvedAmount: r.approvedAmount != null ? Number(r.approvedAmount) : null,
      })),
      openExceptions,
      openExceptionCount: openExceptions.length,
    };
  }

  // ── PRIVATE HELPERS ──────────────────────────────────────────────────────
  private async get(id: string, organizationId: string) {
    const pr = await this.prisma.paymentRequest.findFirst({ where: { id, organizationId } });
    if (!pr) throw new NotFoundException('Payment request not found');
    return pr;
  }

  private assertStatus(pr: { status: PaymentRequestStatus }, allowed: PaymentRequestStatus[], verb: string) {
    if (!allowed.includes(pr.status)) {
      throw new BadRequestException(`Cannot ${verb} a payment request in status ${pr.status}`);
    }
  }

  private async transition(id: string, to: PaymentRequestStatus, action: string, pr: { status: PaymentRequestStatus }, userId: string) {
    const updated = await this.prisma.paymentRequest.update({ where: { id }, data: { status: to } });
    await this.audit.record({
      userId, action, entity: 'PaymentRequest', entityId: id,
      oldValues: { status: pr.status }, newValues: { status: to },
    });
    return this.serialize(updated);
  }

  private async flagException(organizationId: string, paymentRequestId: string, type: PaymentExceptionType, detail: string) {
    await this.prisma.paymentException.create({
      data: { organizationId, paymentRequestId, type, detail, status: 'OPEN' },
    });
    this.logger.warn(`Payment exception ${type} on ${paymentRequestId}: ${detail}`);
  }

  private serialize(pr: any) {
    const out: any = { ...pr };
    for (const f of ['requestedAmount', 'paymentAmount', 'accountBalanceAtRequest']) {
      if (out[f] != null) out[f] = Number(out[f]);
    }
    if (out.operationalAccount?.currentBalance != null) {
      out.operationalAccount = { ...out.operationalAccount, currentBalance: Number(out.operationalAccount.currentBalance) };
    }
    return out;
  }
}
