import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import { Prisma, TransactionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { ExposureService } from '../../common/services/exposure.service';
import { makeReference } from '../../common/utils/reference.util';
import {
  requiredApprovalLevels, roleForLevel, nextApproverRole, canApproveLevel,
} from '../../common/utils/approval-workflow.util';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ApprovalActionDto, VerifyPaymentDto, FulfilmentDto } from './dto/transaction-actions.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';

/** Transaction statuses that still contribute to live credit exposure. */
const ACTIVE_TXN_STATUSES: TransactionStatus[] = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ON_HOLD'];

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly audit:    AuditService,
    private readonly exposure: ExposureService,
  ) {}

  // ── CREATE (from an APPROVED credit request) ─────────────────────────────
  async create(dto: CreateTransactionDto, userId: string, organizationId: string) {
    const creditRequest = await this.prisma.creditRequest.findFirst({
      where:   { id: dto.creditRequestId, organizationId },
      include: { client: true, salesRequest: { select: { id: true, reference: true } } },
    });
    if (!creditRequest) throw new NotFoundException('Credit request not found');
    if (creditRequest.status !== 'APPROVED') {
      throw new BadRequestException(
        `A transaction can only be created from an APPROVED credit request (current: ${creditRequest.status})`,
      );
    }

    const value        = dto.newTransactionValue;
    const supplierCost  = dto.supplierCost ?? 0;
    const { grossMargin, profitPercentage } = this.computeFinancials(value, supplierCost);
    const snapshot = await this.buildExposureSnapshot(creditRequest.clientId, value, creditRequest.client.isBlocked);

    // Honour submit only when the client is eligible — mirrors the submitForReview guard,
    // so create+submit can't bypass exposure/eligibility checks. Otherwise save as DRAFT.
    const willSubmit = !!dto.submit && snapshot.clientEligible;

    const created = await this.prisma.transaction.create({
      data: {
        organizationId,
        reference:        dto.reference?.trim() || makeReference('TXN'),
        srfNumber:        dto.srfNumber?.trim()  || makeReference('SRF'),
        clientId:         creditRequest.clientId,
        clientCode:       creditRequest.client.companyRegistration ?? null,
        salesRequestId:   creditRequest.salesRequestId,
        creditRequestId:  creditRequest.id,

        newTransactionValue: value,
        supplierCost,
        grossMargin,
        profitPercentage,
        currency:         dto.currency || creditRequest.currency,

        ...snapshot,

        paymentSource:    dto.paymentSource,
        status:           willSubmit ? 'PENDING_REVIEW' : 'DRAFT',
        requiredApprovalLevel: requiredApprovalLevels(value),
        approvalLevel:    0,
        currentApproverRole: willSubmit ? roleForLevel(1) : null,
        createdById:      userId,
      },
      include: { client: { select: { id: true, name: true } } },
    });

    await this.audit.record({
      userId, action: 'TRANSACTION_CREATED', entity: 'Transaction', entityId: created.id,
      newValues: {
        reference: created.reference, srfNumber: created.srfNumber, value,
        supplierCost, grossMargin, exceedsLimit: snapshot.exceedsLimit, status: created.status,
      },
    });

    this.logger.log(`Transaction ${created.reference} created (${created.status}) — SRF ${created.srfNumber}`);
    return this.serialize(created);
  }

  // ── LIST ─────────────────────────────────────────────────────────────────
  async findAll(organizationId: string, query: TransactionQueryDto) {
    const { page = 1, limit = 20, status, fulfilmentStatus, clientId, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      organizationId,
      ...(status           && { status }),
      ...(fulfilmentStatus && { fulfilmentStatus }),
      ...(clientId         && { clientId }),
      ...(search && {
        OR: [
          { reference: { contains: search, mode: 'insensitive' } },
          { srfNumber: { contains: search, mode: 'insensitive' } },
          { client:    { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where, skip, take: limit,
        orderBy: [{ status: 'asc' }, { transactionDate: 'desc' }],
        include: {
          client:    { select: { id: true, name: true, riskStatus: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: rows.map(r => this.serialize(r)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── SINGLE ───────────────────────────────────────────────────────────────
  async findOne(id: string, organizationId: string) {
    const txn = await this.prisma.transaction.findFirst({
      where: { id, organizationId },
      include: {
        client:        { select: { id: true, name: true, riskStatus: true, isBlocked: true, creditLimit: true, paymentDisciplineIndex: true } },
        salesRequest:  { select: { id: true, reference: true, title: true } },
        creditRequest: { select: { id: true, reference: true, approvedAmount: true } },
        createdBy:     { select: { id: true, name: true } },
        approvals: {
          orderBy: { createdAt: 'asc' },
          include: { approver: { select: { id: true, name: true, role: true } } },
        },
      },
    });
    if (!txn) throw new NotFoundException('Transaction not found');
    return this.serialize(txn);
  }

  // ── UPDATE (DRAFT only) ──────────────────────────────────────────────────
  async update(id: string, dto: UpdateTransactionDto, organizationId: string, userId: string) {
    const txn = await this.prisma.transaction.findFirst({ where: { id, organizationId }, include: { client: true } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (txn.status !== 'DRAFT') {
      throw new BadRequestException(`Only DRAFT transactions can be edited (current: ${txn.status})`);
    }

    const value        = dto.newTransactionValue ?? Number(txn.newTransactionValue);
    const supplierCost = dto.supplierCost        ?? Number(txn.supplierCost);
    const { grossMargin, profitPercentage } = this.computeFinancials(value, supplierCost);
    const snapshot = await this.buildExposureSnapshot(txn.clientId, value, txn.client.isBlocked);

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        newTransactionValue: value,
        supplierCost,
        grossMargin,
        profitPercentage,
        ...snapshot,
        requiredApprovalLevel: requiredApprovalLevels(value),
        ...(dto.srfNumber     !== undefined && { srfNumber: dto.srfNumber }),
        ...(dto.paymentSource !== undefined && { paymentSource: dto.paymentSource }),
      },
    });

    await this.audit.record({
      userId, action: 'TRANSACTION_UPDATED', entity: 'Transaction', entityId: id,
      oldValues: { value: Number(txn.newTransactionValue), supplierCost: Number(txn.supplierCost) },
      newValues: { value, supplierCost, grossMargin },
    });
    return this.serialize(updated);
  }

  // ── SUBMIT FOR REVIEW (DRAFT → PENDING_REVIEW) ───────────────────────────
  async submitForReview(id: string, organizationId: string, userId: string) {
    const txn = await this.prisma.transaction.findFirst({ where: { id, organizationId } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (txn.status !== 'DRAFT') {
      throw new BadRequestException(`Only DRAFT transactions can be submitted (current: ${txn.status})`);
    }
    if (!txn.clientEligible) {
      throw new BadRequestException(
        'Client is not eligible: transaction is blocked or exceeds the approved credit limit. Resolve exposure before submitting.',
      );
    }

    const required = requiredApprovalLevels(Number(txn.newTransactionValue));
    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        status: 'PENDING_REVIEW',
        approvalLevel: 0,
        requiredApprovalLevel: required,
        currentApproverRole: roleForLevel(1),
      },
    });
    await this.audit.record({
      userId, action: 'TRANSACTION_SUBMITTED', entity: 'Transaction', entityId: id,
      oldValues: { status: txn.status }, newValues: { status: 'PENDING_REVIEW', requiredApprovalLevel: required },
    });
    this.logger.log(`Transaction ${txn.reference} submitted for ${required}-level review`);
    return this.serialize(updated);
  }

  // ── APPROVE (advance one level of the ladder) ────────────────────────────
  async approve(id: string, dto: ApprovalActionDto, organizationId: string, userId: string, role: UserRole) {
    const txn = await this.prisma.transaction.findFirst({ where: { id, organizationId } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (txn.status !== 'PENDING_REVIEW') {
      throw new BadRequestException(`Only transactions in PENDING_REVIEW can be approved (current: ${txn.status})`);
    }

    const nextLevel = txn.approvalLevel + 1;
    if (!canApproveLevel(role, nextLevel)) {
      const required = roleForLevel(nextLevel);
      throw new ForbiddenException(
        `Approval level ${nextLevel} requires ${required} authority or higher. Your role: ${role}.`,
      );
    }

    const value      = Number(txn.newTransactionValue);
    const isFinal     = nextLevel >= txn.requiredApprovalLevel;
    const newStatus: TransactionStatus = isFinal ? 'APPROVED' : 'PENDING_REVIEW';

    const [updated] = await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id },
        data: {
          status:              newStatus,
          approvalLevel:       nextLevel,
          currentApproverRole: isFinal ? null : nextApproverRole(nextLevel, value),
          approvalComments:    dto.comments ?? txn.approvalComments,
        },
      }),
      this.prisma.transactionApproval.create({
        data: {
          transactionId: id,
          level:         nextLevel,
          decision:      'APPROVED',
          approverId:    userId,
          approverRole:  role,
          comments:      dto.comments,
        },
      }),
    ]);

    await this.audit.record({
      userId, action: 'TRANSACTION_APPROVED', entity: 'Transaction', entityId: id,
      oldValues: { status: txn.status, approvalLevel: txn.approvalLevel },
      newValues: { status: newStatus, approvalLevel: nextLevel, level: nextLevel },
    });
    this.logger.log(`Transaction ${txn.reference} approved at level ${nextLevel}/${txn.requiredApprovalLevel} → ${newStatus}`);
    return this.serialize(updated);
  }

  // ── DECLINE / HOLD / RESUME / CANCEL ─────────────────────────────────────
  async decline(id: string, dto: ApprovalActionDto, organizationId: string, userId: string, role: UserRole) {
    return this.recordDecision(id, organizationId, userId, role, {
      from: ['PENDING_REVIEW'], to: 'DECLINED', decision: 'DECLINED',
      action: 'TRANSACTION_DECLINED', dto, clearApprover: true,
    });
  }

  async hold(id: string, dto: ApprovalActionDto, organizationId: string, userId: string, role: UserRole) {
    return this.recordDecision(id, organizationId, userId, role, {
      from: ['PENDING_REVIEW'], to: 'ON_HOLD', decision: 'ON_HOLD',
      action: 'TRANSACTION_HELD', dto,
    });
  }

  async resume(id: string, organizationId: string, userId: string) {
    const txn = await this.prisma.transaction.findFirst({ where: { id, organizationId } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (txn.status !== 'ON_HOLD') {
      throw new BadRequestException(`Only ON_HOLD transactions can be resumed (current: ${txn.status})`);
    }
    const updated = await this.prisma.transaction.update({
      where: { id },
      data:  { status: 'PENDING_REVIEW', currentApproverRole: roleForLevel(txn.approvalLevel + 1) },
    });
    await this.audit.record({
      userId, action: 'TRANSACTION_RESUMED', entity: 'Transaction', entityId: id,
      oldValues: { status: 'ON_HOLD' }, newValues: { status: 'PENDING_REVIEW' },
    });
    return this.serialize(updated);
  }

  async cancel(id: string, organizationId: string, userId: string) {
    const txn = await this.prisma.transaction.findFirst({ where: { id, organizationId } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (!['DRAFT', 'PENDING_REVIEW', 'ON_HOLD'].includes(txn.status)) {
      throw new BadRequestException(`Cannot cancel a transaction in status ${txn.status}`);
    }
    const updated = await this.prisma.transaction.update({
      where: { id }, data: { status: 'CANCELLED', currentApproverRole: null },
    });
    await this.audit.record({
      userId, action: 'TRANSACTION_CANCELLED', entity: 'Transaction', entityId: id,
      oldValues: { status: txn.status }, newValues: { status: 'CANCELLED' },
    });
    return this.serialize(updated);
  }

  // ── PAYMENT VERIFICATION ─────────────────────────────────────────────────
  async verifyPayment(id: string, dto: VerifyPaymentDto, organizationId: string, userId: string) {
    const txn = await this.prisma.transaction.findFirst({ where: { id, organizationId } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (['CANCELLED', 'DECLINED'].includes(txn.status)) {
      throw new BadRequestException(`Cannot verify payment on a ${txn.status} transaction`);
    }

    const verified = dto.paymentVerified ?? (dto.clientPaymentStatus === 'VERIFIED');
    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        clientPaymentStatus: dto.clientPaymentStatus,
        paymentVerified:     verified,
        ...(dto.paymentSource !== undefined && { paymentSource: dto.paymentSource }),
        paymentDate:         dto.paymentDate ? new Date(dto.paymentDate) : txn.paymentDate,
      },
    });
    await this.audit.record({
      userId, action: 'TRANSACTION_PAYMENT_VERIFIED', entity: 'Transaction', entityId: id,
      oldValues: { clientPaymentStatus: txn.clientPaymentStatus, paymentVerified: txn.paymentVerified },
      newValues: { clientPaymentStatus: dto.clientPaymentStatus, paymentVerified: verified },
    });
    return this.serialize(updated);
  }

  // ── SERVICE FULFILMENT (approved transactions only) ──────────────────────
  async updateFulfilment(id: string, dto: FulfilmentDto, organizationId: string, userId: string) {
    const txn = await this.prisma.transaction.findFirst({ where: { id, organizationId } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (txn.status !== 'APPROVED') {
      throw new BadRequestException('Fulfilment can only be tracked on an APPROVED transaction');
    }
    const updated = await this.prisma.transaction.update({
      where: { id }, data: { fulfilmentStatus: dto.fulfilmentStatus },
    });
    await this.audit.record({
      userId, action: 'TRANSACTION_FULFILMENT_UPDATED', entity: 'Transaction', entityId: id,
      oldValues: { fulfilmentStatus: txn.fulfilmentStatus }, newValues: { fulfilmentStatus: dto.fulfilmentStatus },
    });
    return this.serialize(updated);
  }

  // ── DASHBOARD ────────────────────────────────────────────────────────────
  async getDashboard(organizationId: string) {
    const [statusGroups, fulfilmentGroups, exposureAgg, awaitingVerification, pendingList, highRisk] =
      await Promise.all([
        this.prisma.transaction.groupBy({
          by: ['status'], where: { organizationId }, _count: { _all: true },
        }),
        this.prisma.transaction.groupBy({
          by: ['fulfilmentStatus'], where: { organizationId, status: 'APPROVED' }, _count: { _all: true },
        }),
        this.prisma.transaction.aggregate({
          where: { organizationId, status: { in: ACTIVE_TXN_STATUSES } },
          _sum:  { postTransactionExposure: true, newTransactionValue: true },
        }),
        this.prisma.transaction.count({
          where: { organizationId, paymentVerified: false, status: { in: ['DRAFT', 'PENDING_REVIEW', 'APPROVED'] } },
        }),
        this.prisma.transaction.findMany({
          where: { organizationId, status: 'PENDING_REVIEW' },
          orderBy: { transactionDate: 'asc' },
          take: 10,
          include: { client: { select: { id: true, name: true, riskStatus: true } } },
        }),
        this.prisma.transaction.findMany({
          where: {
            organizationId,
            status: { in: ACTIVE_TXN_STATUSES },
            OR: [{ exceedsLimit: true }, { client: { riskStatus: { in: ['HIGH_RISK', 'CHRONIC'] } } }],
          },
          orderBy: { postTransactionExposure: 'desc' },
          take: 8,
          include: { client: { select: { id: true, name: true, riskStatus: true } } },
        }),
      ]);

    const statusCounts = this.countMap(statusGroups, 'status');
    const overLimitCount = await this.prisma.transaction.count({
      where: { organizationId, status: { in: ACTIVE_TXN_STATUSES }, exceedsLimit: true },
    });

    return {
      pendingApprovals: statusCounts['PENDING_REVIEW'] ?? 0,
      statusCounts,
      exposure: {
        totalExposure:  Number(exposureAgg._sum.postTransactionExposure ?? 0),
        activeValue:    Number(exposureAgg._sum.newTransactionValue ?? 0),
        overLimitCount,
      },
      awaitingVerification,
      fulfilment: this.countMap(fulfilmentGroups, 'fulfilmentStatus'),
      highRiskClients: highRisk.map(t => this.serialize(t)),
      pendingReview:   pendingList.map(t => this.serialize(t)),
    };
  }

  // ── PRIVATE HELPERS ──────────────────────────────────────────────────────

  private computeFinancials(value: number, supplierCost: number) {
    const grossMargin      = +(value - supplierCost).toFixed(2);
    const profitPercentage = value > 0 ? +((grossMargin / value) * 100).toFixed(2) : 0;
    return { grossMargin, profitPercentage };
  }

  /** Build the exposure snapshot + eligibility flags for a proposed transaction value. */
  private async buildExposureSnapshot(clientId: string, value: number, isBlocked: boolean) {
    const exp = await this.exposure.getClientExposure(clientId);
    const postTransactionExposure = +(exp.currentExposure + value).toFixed(2);
    const exceedsLimit  = exp.creditLimit > 0 && postTransactionExposure > exp.creditLimit;
    const clientEligible = !isBlocked && !exceedsLimit;
    return {
      creditLimit:     exp.creditLimit,
      currentExposure: exp.currentExposure,
      postTransactionExposure,
      availableCredit: exp.availableCredit,
      exceedsLimit,
      clientEligible,
    };
  }

  private async recordDecision(
    id: string, organizationId: string, userId: string, role: UserRole,
    opts: {
      from: TransactionStatus[]; to: TransactionStatus;
      decision: 'DECLINED' | 'ON_HOLD'; action: string;
      dto: ApprovalActionDto; clearApprover?: boolean;
    },
  ) {
    const txn = await this.prisma.transaction.findFirst({ where: { id, organizationId } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (!opts.from.includes(txn.status)) {
      throw new BadRequestException(`Cannot ${opts.to.toLowerCase().replace('_', ' ')} a transaction in status ${txn.status}`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id },
        data: {
          status: opts.to,
          approvalComments: opts.dto.comments ?? txn.approvalComments,
          ...(opts.clearApprover && { currentApproverRole: null }),
        },
      }),
      this.prisma.transactionApproval.create({
        data: {
          transactionId: id,
          level:         txn.approvalLevel + 1,
          decision:      opts.decision,
          approverId:    userId,
          approverRole:  role,
          comments:      opts.dto.comments,
        },
      }),
    ]);

    await this.audit.record({
      userId, action: opts.action, entity: 'Transaction', entityId: id,
      oldValues: { status: txn.status }, newValues: { status: opts.to },
    });
    this.logger.log(`Transaction ${txn.reference}: ${txn.status} → ${opts.to}`);
    return this.serialize(updated);
  }

  private countMap(groups: Array<Record<string, any>>, key: string): Record<string, number> {
    return groups.reduce((acc, g) => {
      acc[g[key]] = g._count._all;
      return acc;
    }, {} as Record<string, number>);
  }

  /** Coerce Prisma Decimals to numbers for a clean JSON contract. */
  private serialize(txn: any) {
    const decimalFields = [
      'newTransactionValue', 'supplierCost', 'grossMargin', 'profitPercentage',
      'creditLimit', 'currentExposure', 'postTransactionExposure', 'availableCredit',
    ];
    const out: any = { ...txn };
    for (const f of decimalFields) {
      if (out[f] !== undefined && out[f] !== null) out[f] = Number(out[f]);
    }
    if (out.client?.creditLimit !== undefined && out.client?.creditLimit !== null) {
      out.client = { ...out.client, creditLimit: Number(out.client.creditLimit) };
    }
    return out;
  }
}
