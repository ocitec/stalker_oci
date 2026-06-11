import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { addDays, differenceInDays, isToday, isBefore } from 'date-fns';
import { PrismaService } from '../../config/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { RevertPaymentDto } from './dto/revert-payment.dto';
import { EmailJobName } from '../email/email.types';

const BALANCE_EPSILON = 0.005;

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    @InjectQueue('alerts') private alertsQueue: Queue,
    @InjectQueue('emails') private emailsQueue: Queue,
  ) {}

  // ── CREATE ─────────────────────────────────────────────────────────────────
  async create(dto: CreateInvoiceDto, organizationId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, organizationId },
    });
    if (!client) throw new NotFoundException('Client not found');
    if (client.isBlocked) {
      throw new BadRequestException(
        `Client is blocked: ${client.blockedReason}. Resolve outstanding issues before creating new invoices.`,
      );
    }

    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : addDays(invoiceDate, client.slaDays);

    const initialStatus = this.resolveStatus(dueDate);

    const invoice = await this.prisma.invoice.create({
      data: {
        clientId:         dto.clientId,
        invoiceNumber:    dto.invoiceNumber,
        invoiceAmount:    dto.invoiceAmount,
        remainingBalance: dto.invoiceAmount,
        amountPaid:       0,
        invoiceDate,
        dueDate,
        currency: dto.currency || 'NGN',
        notes:    dto.notes,
        status:   initialStatus,
      },
      include: { client: true },
    });

    // Create SLA violation immediately when invoice is already past due
    if (initialStatus === 'OVERDUE') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await this.prisma.slaViolation.create({
        data: {
          clientId:  dto.clientId,
          invoiceId: invoice.id,
          daysLate:  differenceInDays(today, dueDate),
        },
      });
    }

    await this.alertsQueue.add('schedule-alerts', {
      invoiceId: invoice.id,
      dueDate:   dueDate.toISOString(),
      clientId:  dto.clientId,
      amount:    dto.invoiceAmount,
    });

    // Notify client of new invoice
    if (client.email) {
      await this.emailsQueue.add(
        EmailJobName.INVOICE_CREATED,
        {
          invoiceId:     invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientName:    client.name,
          clientEmail:   client.email,
          amount:        dto.invoiceAmount,
          invoiceDate:   invoiceDate.toISOString(),
          dueDate:       dueDate.toISOString(),
          currency:      dto.currency || 'NGN',
          notes:         dto.notes,
        },
        { jobId: `${EmailJobName.INVOICE_CREATED}:${invoice.id}` },
      );
    }

    // Credit limit breach alert when the client's outstanding balance exceeds their limit
    const creditLimit = Number(client.creditLimit);
    if (creditLimit > 0) {
      const outstandingResult = await this.prisma.invoice.aggregate({
        where: { clientId: client.id, status: { in: ['PENDING', 'DUE_TODAY', 'OVERDUE', 'PARTIALLY_PAID'] } },
        _sum:  { remainingBalance: true },
      });
      const outstanding     = Number(outstandingResult._sum.remainingBalance ?? 0);
      const utilizationPct  = Math.round((outstanding / creditLimit) * 100);

      if (utilizationPct >= 90) {
        await this.emailsQueue.add(
          EmailJobName.CREDIT_LIMIT_BREACHED,
          {
            invoiceId:          invoice.id,
            invoiceNumber:      invoice.invoiceNumber,
            clientId:           client.id,
            clientName:         client.name,
            creditLimit,
            currentOutstanding: outstanding,
            utilizationPercent: utilizationPct,
            organizationId:     client.organizationId,
          },
          { jobId: `${EmailJobName.CREDIT_LIMIT_BREACHED}:${invoice.id}` },
        );
      }
    }

    // Recalculate PDI immediately so new invoice is reflected in risk scores
    await this.clientsService.recalculatePDI(dto.clientId);

    this.logger.log(`Invoice created: ${invoice.invoiceNumber} for ${client.name}`);
    return invoice;
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateInvoiceDto, organizationId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, client: { organizationId } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new BadRequestException(
        `Cannot edit a ${invoice.status.toLowerCase()} invoice`,
      );
    }

    // Amount and invoice date edits only allowed when no payments have been made
    if (dto.invoiceAmount !== undefined || dto.invoiceDate !== undefined) {
      if (invoice.status !== 'PENDING') {
        throw new BadRequestException(
          'Invoice amount and date can only be changed on a PENDING invoice with no payments recorded',
        );
      }
    }

    const updateData: Record<string, any> = {};
    if (dto.invoiceNumber !== undefined) updateData.invoiceNumber = dto.invoiceNumber;
    if (dto.currency     !== undefined) updateData.currency      = dto.currency;
    if (dto.notes        !== undefined) updateData.notes         = dto.notes;
    if (dto.invoiceDate  !== undefined) updateData.invoiceDate   = new Date(dto.invoiceDate);
    if (dto.invoiceAmount !== undefined) {
      updateData.invoiceAmount    = dto.invoiceAmount;
      updateData.remainingBalance = dto.invoiceAmount; // PENDING = no payments yet
    }

    // Recalculate status when due date changes (skip PARTIALLY_PAID — payment state takes precedence)
    if (dto.dueDate !== undefined) {
      const newDueDate = new Date(dto.dueDate);
      updateData.dueDate = newDueDate;
      if (invoice.status !== 'PARTIALLY_PAID') {
        updateData.status = this.resolveStatus(newDueDate);
      }
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data:  updateData,
      include: {
        client:    true,
        followUps: { orderBy: { followUpDate: 'desc' } },
        payments:  { orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true } } } },
      },
    });

    // Ensure an SLA violation exists if the invoice is now overdue
    if (updated.status === 'OVERDUE') {
      const existingViolation = await this.prisma.slaViolation.findFirst({
        where: { invoiceId: id },
      });
      if (!existingViolation) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await this.prisma.slaViolation.create({
          data: {
            clientId:  invoice.clientId,
            invoiceId: id,
            daysLate:  differenceInDays(today, updated.dueDate),
          },
        });
      }
    }

    // Keep PDI in sync after any invoice edit
    await this.clientsService.recalculatePDI(invoice.clientId);

    this.logger.log(`Invoice ${invoice.invoiceNumber} updated`);
    return this.enrichInvoice(updated);
  }

  // ── LIST ───────────────────────────────────────────────────────────────────
  async findAll(organizationId: string, query: InvoiceQueryDto) {
    const { page = 1, limit = 20, status, clientId, search, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      client: { organizationId },
      ...(status   && { status }),
      ...(clientId && { clientId }),
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
      ...(dateFrom && { invoiceDate: { gte: new Date(dateFrom) } }),
      ...(dateTo   && { invoiceDate: { lte: new Date(dateTo) } }),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where, skip, take: limit,
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        include: {
          client: {
            select: { id: true, name: true, paymentDisciplineIndex: true, riskStatus: true },
          },
          followUps: { orderBy: { followUpDate: 'desc' }, take: 1 },
          payments: {
            where:   { isReverted: false },
            orderBy: { paymentDate: 'desc' },
            take:    1,
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices.map(inv => this.enrichInvoice(inv)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── OVERDUE LIST ───────────────────────────────────────────────────────────
  async findOverdue(organizationId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['OVERDUE', 'PARTIALLY_PAID'] },
        client: { organizationId },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        client: {
          select: { id: true, name: true, paymentDisciplineIndex: true, riskStatus: true },
        },
        followUps:     { orderBy: { followUpDate: 'desc' }, take: 1 },
        slaViolations: { orderBy: { violationDate: 'desc' }, take: 1 },
      },
    });
    return invoices.map(inv => this.enrichInvoice(inv));
  }

  // ── SINGLE ─────────────────────────────────────────────────────────────────
  async findOne(id: string, organizationId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, client: { organizationId } },
      include: {
        client: true,
        followUps: {
          orderBy: { followUpDate: 'desc' },
          include: { user: { select: { id: true, name: true, role: true } } },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true } } },
        },
        slaViolations: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.enrichInvoice(invoice);
  }

  // ── MARK AS PAID (full or partial) ─────────────────────────────────────────
  async markAsPaid(
    id:             string,
    dto:            MarkPaidDto,
    organizationId: string,
    userId:         string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, client: { organizationId } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already fully paid');
    }
    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Cannot record a payment on a cancelled invoice');
    }

    const totalAmount      = Number(invoice.invoiceAmount);
    const currentPaid      = Number(invoice.amountPaid ?? 0);
    const currentRemaining = Number(
      invoice.remainingBalance ?? (totalAmount - currentPaid),
    );

    // Omitting paymentAmount pays the full remaining balance
    const paymentAmount = dto.paymentAmount != null
      ? Number(dto.paymentAmount)
      : currentRemaining;

    if (paymentAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }
    if (paymentAmount > currentRemaining + BALANCE_EPSILON) {
      throw new BadRequestException(
        `Payment amount (${paymentAmount.toFixed(2)}) exceeds the remaining balance (${currentRemaining.toFixed(2)})`,
      );
    }

    const newAmountPaid       = +(currentPaid + paymentAmount).toFixed(2);
    const newRemainingBalance  = +Math.max(0, totalAmount - newAmountPaid).toFixed(2);
    const isFullyPaid          = newRemainingBalance <= BALANCE_EPSILON;
    const newStatus: InvoiceStatus = isFullyPaid ? 'PAID' : 'PARTIALLY_PAID';
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

    const [updatedInvoice, paymentRecord] = await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id },
        data: {
          amountPaid:       newAmountPaid,
          remainingBalance: newRemainingBalance,
          paidAmount:       newAmountPaid,
          status:           newStatus,
          paidDate:         isFullyPaid ? paymentDate : (invoice.paidDate ?? null),
        },
        include: {
          client: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.paymentRecord.create({
        data: {
          invoiceId:   id,
          paidBy:      userId,
          amount:      paymentAmount,
          paymentDate,
          notes:       dto.notes ?? null,
          isReverted:  false,
        },
      }),
    ]);

    if (isFullyPaid) {
      await this.clientsService.recalculatePDI(invoice.clientId);
      await this.prisma.slaViolation.updateMany({
        where: { invoiceId: id, resolved: false },
        data:  { resolved: true, resolvedAt: new Date() },
      });
    }

    // Email notifications: client receipt + finance confirmation
    const clientEmail = (updatedInvoice as any).client?.email;
    const clientName  = (updatedInvoice as any).client?.name;
    const orgId       = (updatedInvoice as any).client?.organizationId;
    const recordedBy  = (updatedInvoice as any).payments?.[0]?.user?.name;

    if (clientEmail) {
      const clientJobName = isFullyPaid ? EmailJobName.PAYMENT_RECEIPT : EmailJobName.PARTIAL_PAYMENT_RECEIPT;
      await this.emailsQueue.add(
        clientJobName,
        {
          invoiceId:        id,
          invoiceNumber:    invoice.invoiceNumber,
          clientName,
          clientEmail,
          totalAmount:      updatedInvoice.invoiceAmount,
          amountPaid:       newAmountPaid,
          remainingBalance: newRemainingBalance,
          paymentDate:      paymentDate.toISOString(),
          paymentRecordId:  paymentRecord.id,
          ...(isFullyPaid ? { paidBy: recordedBy } : {}),
        },
        { jobId: `${clientJobName}:${paymentRecord.id}` },
      );
    }

    if (orgId) {
      await this.emailsQueue.add(
        EmailJobName.PAYMENT_CONFIRMATION,
        {
          invoiceId:        id,
          invoiceNumber:    invoice.invoiceNumber,
          clientName,
          amountPaid:       newAmountPaid,
          remainingBalance: newRemainingBalance,
          isFullyPaid,
          paymentDate:      paymentDate.toISOString(),
          recordedBy,
          organizationId:   orgId,
          paymentRecordId:  paymentRecord.id,
        },
        { jobId: `${EmailJobName.PAYMENT_CONFIRMATION}:${paymentRecord.id}` },
      );
    }

    this.logger.log(
      `Payment of ${paymentAmount} on ${invoice.invoiceNumber} — ` +
      `status: ${newStatus}, remaining: ${newRemainingBalance}`,
    );

    return {
      invoice:          this.enrichInvoice(updatedInvoice),
      payment:          paymentRecord,
      isFullyPaid,
      amountPaid:       newAmountPaid,
      remainingBalance: newRemainingBalance,
    };
  }

  // ── REVERT PAYMENT ─────────────────────────────────────────────────────────
  async revertPayment(
    id:             string,
    dto:            RevertPaymentDto,
    organizationId: string,
    userId:         string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, client: { organizationId } },
      include: {
        payments: {
          where:   { isReverted: false },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Cannot revert a payment on a cancelled invoice');
    }

    const activePayments = invoice.payments;
    if (!activePayments.length) {
      throw new BadRequestException('No active payments found to revert');
    }

    const mostRecent = activePayments[0];
    if (mostRecent.id !== dto.paymentRecordId) {
      throw new BadRequestException(
        'Only the most recent payment can be reverted. ' +
        'Revert in reverse chronological order if multiple payments need to be undone.',
      );
    }

    const totalAmount        = Number(invoice.invoiceAmount);
    const revertedAmount     = Number(mostRecent.amount);
    const newAmountPaid      = +Math.max(0, Number(invoice.amountPaid) - revertedAmount).toFixed(2);
    const newRemainingBalance = +(totalAmount - newAmountPaid).toFixed(2);
    const remainingActive    = activePayments.length - 1;

    let restoredStatus: InvoiceStatus;
    if (newAmountPaid > BALANCE_EPSILON && remainingActive > 0) {
      restoredStatus = 'PARTIALLY_PAID';
    } else {
      const dueDate = new Date(invoice.dueDate);
      if (isToday(dueDate))            restoredStatus = 'DUE_TODAY';
      else if (isBefore(dueDate, new Date())) restoredStatus = 'OVERDUE';
      else                             restoredStatus = 'PENDING';
    }

    const [updatedInvoice] = await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id },
        data: {
          amountPaid:       newAmountPaid,
          remainingBalance: newRemainingBalance,
          paidAmount:       newAmountPaid,
          status:           restoredStatus,
          paidDate:         newAmountPaid <= BALANCE_EPSILON ? null : (invoice.paidDate ?? null),
        },
        include: {
          client: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.paymentRecord.update({
        where: { id: dto.paymentRecordId },
        data: {
          isReverted: true,
          revertedAt: new Date(),
          revertedBy: userId,
        },
      }),
    ]);

    if (invoice.status === 'PAID') {
      await this.clientsService.recalculatePDI(invoice.clientId);
      if (restoredStatus === 'OVERDUE') {
        await this.prisma.slaViolation.updateMany({
          where: { invoiceId: id, resolved: true },
          data:  { resolved: false, resolvedAt: null },
        });
      }
    }

    // CFO audit alert for payment reversal
    const orgId      = (updatedInvoice as any).client?.organizationId;
    const clientName = (updatedInvoice as any).client?.name;
    const revertedByUser = (updatedInvoice as any).payments?.find((p: any) => p.id === dto.paymentRecordId)?.user?.name;

    if (orgId) {
      await this.emailsQueue.add(
        EmailJobName.PAYMENT_REVERTED,
        {
          invoiceId:       id,
          invoiceNumber:   invoice.invoiceNumber,
          clientName,
          revertedAmount,
          restoredStatus,
          revertedBy:      revertedByUser,
          organizationId:  orgId,
          paymentRecordId: dto.paymentRecordId,
        },
        { jobId: `${EmailJobName.PAYMENT_REVERTED}:${dto.paymentRecordId}` },
      );
    }

    this.logger.log(
      `Payment of ${revertedAmount} reverted on ${invoice.invoiceNumber} ` +
      `— restored: ${restoredStatus}`,
    );

    return {
      invoice:             this.enrichInvoice(updatedInvoice),
      revertedAmount,
      restoredStatus,
      newAmountPaid,
      newRemainingBalance,
    };
  }

  // ── STATUS SYNC (cron) ─────────────────────────────────────────────────────
  async syncInvoiceStatuses(): Promise<{ updated: number }> {
    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = addDays(today, 1);

    const dueTodayResult = await this.prisma.invoice.updateMany({
      where: { status: 'PENDING', dueDate: { gte: today, lt: tomorrow } },
      data:  { status: 'DUE_TODAY' },
    });

    const overdueResult = await this.prisma.invoice.updateMany({
      where: { status: { in: ['PENDING', 'DUE_TODAY'] }, dueDate: { lt: today } },
      data:  { status: 'OVERDUE' },
    });

    const newlyOverdue = await this.prisma.invoice.findMany({
      where:   { status: 'OVERDUE', slaViolations: { none: {} } },
      include: {
        client: { select: { id: true, name: true, organizationId: true } },
      },
    });

    const affectedClientIds = new Set<string>();
    for (const inv of newlyOverdue) {
      const daysLate = differenceInDays(today, inv.dueDate);
      await this.prisma.slaViolation.create({
        data: {
          clientId:  inv.clientId,
          invoiceId: inv.id,
          daysLate,
        },
      });

      // Finance team alert for new SLA breach
      await this.emailsQueue.add(
        EmailJobName.NEW_SLA_VIOLATION,
        {
          invoiceId:      inv.id,
          invoiceNumber:  inv.invoiceNumber,
          clientName:     inv.client.name,
          amount:         inv.invoiceAmount,
          dueDate:        inv.dueDate.toISOString(),
          daysLate,
          organizationId: inv.client.organizationId,
        },
        { jobId: `${EmailJobName.NEW_SLA_VIOLATION}:${inv.id}` },
      );

      affectedClientIds.add(inv.clientId);
    }

    // Recalculate PDI immediately for clients with newly overdue invoices
    for (const clientId of affectedClientIds) {
      await this.clientsService.recalculatePDI(clientId);
    }

    const total = dueTodayResult.count + overdueResult.count;
    if (total > 0) {
      this.logger.log(`Status sync: ${overdueResult.count} overdue, ${dueTodayResult.count} due today`);
    }
    return { updated: total };
  }

  // ── AGING REPORT ───────────────────────────────────────────────────────────
  async getAgingReport(organizationId: string) {
    const today    = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        client: { organizationId },
        status: { in: ['PENDING', 'DUE_TODAY', 'OVERDUE', 'PARTIALLY_PAID'] },
      },
      select: { invoiceAmount: true, remainingBalance: true, dueDate: true, status: true },
    });

    const buckets = {
      current: { value: 0, count: 0 },
      '1_30':  { value: 0, count: 0 },
      '31_60': { value: 0, count: 0 },
      '61_90': { value: 0, count: 0 },
      over_90: { value: 0, count: 0 },
    };

    for (const inv of invoices) {
      const amount      = Number(inv.remainingBalance ?? inv.invoiceAmount);
      const daysOverdue = differenceInDays(today, inv.dueDate);
      if (daysOverdue <= 0)       { buckets.current.value += amount; buckets.current.count++; }
      else if (daysOverdue <= 30) { buckets['1_30'].value  += amount; buckets['1_30'].count++;  }
      else if (daysOverdue <= 60) { buckets['31_60'].value += amount; buckets['31_60'].count++; }
      else if (daysOverdue <= 90) { buckets['61_90'].value += amount; buckets['61_90'].count++; }
      else                        { buckets.over_90.value  += amount; buckets.over_90.count++;  }
    }
    return buckets;
  }

  // ── DSO ────────────────────────────────────────────────────────────────────
  async calculateDSO(organizationId: string, days = 90): Promise<number> {
    const fromDate = addDays(new Date(), -days);
    const result   = await this.prisma.invoice.aggregate({
      where: { client: { organizationId }, status: 'PAID', paidDate: { gte: fromDate } },
      _sum:  { invoiceAmount: true },
    });
    const totalRevenue = Number(result._sum.invoiceAmount || 0);
    if (totalRevenue === 0) return 0;

    const outstandingResult = await this.prisma.invoice.aggregate({
      where: {
        client: { organizationId },
        status: { in: ['PENDING', 'DUE_TODAY', 'OVERDUE', 'PARTIALLY_PAID'] },
      },
      _sum: { remainingBalance: true },
    });
    const outstanding  = Number(outstandingResult._sum.remainingBalance || 0);
    const dailyRevenue = totalRevenue / days;
    return dailyRevenue > 0 ? Math.round(outstanding / dailyRevenue) : 0;
  }

  // ── PRIVATE HELPERS ────────────────────────────────────────────────────────

  private resolveStatus(dueDate: Date): InvoiceStatus {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = addDays(today, 1);
    if (dueDate < today)    return 'OVERDUE';
    if (dueDate < tomorrow) return 'DUE_TODAY';
    return 'PENDING';
  }

  private enrichInvoice(invoice: any) {
    const today             = new Date();
    const daysOverdue       = ['OVERDUE', 'PARTIALLY_PAID'].includes(invoice.status)
      ? Math.max(0, differenceInDays(today, new Date(invoice.dueDate)))
      : 0;
    const daysToDue         = invoice.status === 'PENDING'
      ? differenceInDays(new Date(invoice.dueDate), today)
      : null;
    const lastFollowUp      = invoice.followUps?.[0];
    const daysSinceFollowUp = lastFollowUp
      ? differenceInDays(today, new Date(lastFollowUp.followUpDate))
      : null;

    const totalAmount        = Number(invoice.invoiceAmount);
    const amountPaid         = Number(invoice.amountPaid ?? 0);
    const remainingBalance   = Number(invoice.remainingBalance ?? (totalAmount - amountPaid));
    const paymentProgressPct = totalAmount > 0
      ? Math.min(100, Math.round((amountPaid / totalAmount) * 100))
      : 0;

    let colorCode: 'green' | 'blue' | 'amber' | 'red' = 'green';
    if (invoice.status === 'OVERDUE')             colorCode = 'red';
    else if (invoice.status === 'DUE_TODAY')      colorCode = 'amber';
    else if (invoice.status === 'PARTIALLY_PAID') colorCode = 'blue';
    else if (daysToDue !== null && daysToDue <= 7) colorCode = 'blue';

    return {
      ...invoice,
      daysOverdue,
      daysToDue,
      daysSinceFollowUp,
      colorCode,
      followUpAlert:     daysSinceFollowUp !== null && daysSinceFollowUp > 5,
      amountPaid,
      remainingBalance,
      paymentProgressPct,
    };
  }
}