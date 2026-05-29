import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { addDays, differenceInDays, isAfter, isToday, isBefore } from 'date-fns';
import { PrismaService } from '../../config/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    @InjectQueue('alerts') private alertsQueue: Queue,
  ) {}

  async create(dto: CreateInvoiceDto, organizationId: string) {
    // Validate client exists and not blocked
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, organizationId },
    });
    if (!client) throw new NotFoundException('Client not found');
    if (client.isBlocked) {
      throw new BadRequestException(
        `Client is blocked: ${client.blockedReason}. Resolve outstanding issues before creating new invoices.`,
      );
    }

    // Auto-calculate due date from SLA
    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : addDays(invoiceDate, client.slaDays);

    const invoice = await this.prisma.invoice.create({
      data: {
        clientId: dto.clientId,
        invoiceNumber: dto.invoiceNumber,
        invoiceAmount: dto.invoiceAmount,
        invoiceDate,
        dueDate,
        currency: dto.currency || 'NGN',
        notes: dto.notes,
        status: 'PENDING',
      },
      include: { client: true },
    });

    // Queue pre-due alert scheduling
    await this.alertsQueue.add('schedule-alerts', {
      invoiceId: invoice.id,
      dueDate: dueDate.toISOString(),
      clientId: dto.clientId,
      amount: dto.invoiceAmount,
    });

    this.logger.log(`Invoice created: ${invoice.invoiceNumber} for ${client.name}`);
    return invoice;
  }

  async findAll(organizationId: string, query: InvoiceQueryDto) {
    const { page = 1, limit = 20, status, clientId, search, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      client: { organizationId },
      ...(status && { status }),
      ...(clientId && { clientId }),
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
      ...(dateFrom && { invoiceDate: { gte: new Date(dateFrom) } }),
      ...(dateTo && { invoiceDate: { lte: new Date(dateTo) } }),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where, skip, take: limit,
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        include: {
          client: { select: { id: true, name: true, paymentDisciplineIndex: true, riskStatus: true } },
          followUps: { orderBy: { followUpDate: 'desc' }, take: 1 },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices.map(inv => this.enrichInvoice(inv)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOverdue(organizationId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: 'OVERDUE',
        client: { organizationId },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        client: { select: { id: true, name: true, paymentDisciplineIndex: true, riskStatus: true } },
        followUps: { orderBy: { followUpDate: 'desc' }, take: 1 },
        slaViolations: { orderBy: { violationDate: 'desc' }, take: 1 },
      },
    });
    return invoices.map(inv => this.enrichInvoice(inv));
  }

  async findOne(id: string, organizationId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, client: { organizationId } },
      include: {
        client: true,
        followUps: {
          orderBy: { followUpDate: 'desc' },
          include: { user: { select: { id: true, name: true, role: true } } },
        },
        slaViolations: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.enrichInvoice(invoice);
  }

  async markAsPaid(id: string, dto: MarkPaidDto, organizationId: string) {
    const invoice = await this.findOne(id, organizationId);
    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already marked as paid');
    }

    const paidDate = dto.paidDate ? new Date(dto.paidDate) : new Date();

    await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidDate,
        paidAmount: dto.paidAmount || invoice.invoiceAmount,
      },
    });

    // Trigger PDI recalculation
    await this.clientsService.recalculatePDI(invoice.clientId);

    // Resolve SLA violation if exists
    await this.prisma.slaViolation.updateMany({
      where: { invoiceId: id, resolved: false },
      data: { resolved: true, resolvedAt: new Date() },
    });

    return { message: 'Invoice marked as paid', paidDate };
  }

  // ── STATUS SYNC ENGINE (called by cron) ──────────────────
  async syncInvoiceStatuses(): Promise<{ updated: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = addDays(today, 1);

    // Mark DUE_TODAY
    const dueTodayResult = await this.prisma.invoice.updateMany({
      where: {
        status: 'PENDING',
        dueDate: { gte: today, lt: tomorrow },
      },
      data: { status: 'DUE_TODAY' },
    });

    // Mark OVERDUE
    const overdueResult = await this.prisma.invoice.updateMany({
      where: {
        status: { in: ['PENDING', 'DUE_TODAY'] },
        dueDate: { lt: today },
      },
      data: { status: 'OVERDUE' },
    });

    // Create SLA violations for newly overdue
    const newlyOverdue = await this.prisma.invoice.findMany({
      where: {
        status: 'OVERDUE',
        slaViolations: { none: {} },
      },
      select: { id: true, clientId: true, dueDate: true },
    });

    for (const inv of newlyOverdue) {
      const daysLate = differenceInDays(today, inv.dueDate);
      await this.prisma.slaViolation.create({
        data: {
          clientId: inv.clientId,
          invoiceId: inv.id,
          daysLate,
        },
      });
    }

    const total = dueTodayResult.count + overdueResult.count;
    if (total > 0) this.logger.log(`Status sync: ${overdueResult.count} overdue, ${dueTodayResult.count} due today`);
    return { updated: total };
  }

  // ── AGING REPORT ──────────────────────────────
  async getAgingReport(organizationId: string) {
    const today = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        client: { organizationId },
        status: { in: ['PENDING', 'DUE_TODAY', 'OVERDUE'] },
      },
      select: { invoiceAmount: true, dueDate: true, status: true, clientId: true },
    });

    const buckets = {
      current: { value: 0, count: 0 },
      '1_30': { value: 0, count: 0 },
      '31_60': { value: 0, count: 0 },
      '61_90': { value: 0, count: 0 },
      over_90: { value: 0, count: 0 },
    };

    for (const inv of invoices) {
      const daysOverdue = differenceInDays(today, inv.dueDate);
      const amount = Number(inv.invoiceAmount);
      if (daysOverdue <= 0) { buckets.current.value += amount; buckets.current.count++; }
      else if (daysOverdue <= 30) { buckets['1_30'].value += amount; buckets['1_30'].count++; }
      else if (daysOverdue <= 60) { buckets['31_60'].value += amount; buckets['31_60'].count++; }
      else if (daysOverdue <= 90) { buckets['61_90'].value += amount; buckets['61_90'].count++; }
      else { buckets.over_90.value += amount; buckets.over_90.count++; }
    }

    return buckets;
  }

  // ── DSO CALCULATION ───────────────────────────
  async calculateDSO(organizationId: string, days = 90): Promise<number> {
    const fromDate = addDays(new Date(), -days);
    const result = await this.prisma.invoice.aggregate({
      where: {
        client: { organizationId },
        status: 'PAID',
        paidDate: { gte: fromDate },
      },
      _sum: { invoiceAmount: true },
    });

    const totalRevenue = Number(result._sum.invoiceAmount || 0);
    if (totalRevenue === 0) return 0;

    const outstandingResult = await this.prisma.invoice.aggregate({
      where: {
        client: { organizationId },
        status: { in: ['PENDING', 'DUE_TODAY', 'OVERDUE'] },
      },
      _sum: { invoiceAmount: true },
    });

    const outstanding = Number(outstandingResult._sum.invoiceAmount || 0);
    const dailyRevenue = totalRevenue / days;
    return dailyRevenue > 0 ? Math.round(outstanding / dailyRevenue) : 0;
  }

  private enrichInvoice(invoice: any) {
    const today = new Date();
    const daysOverdue = invoice.status === 'OVERDUE'
      ? differenceInDays(today, new Date(invoice.dueDate))
      : 0;
    const daysToDue = invoice.status === 'PENDING'
      ? differenceInDays(new Date(invoice.dueDate), today)
      : null;
    const lastFollowUp = invoice.followUps?.[0];
    const daysSinceFollowUp = lastFollowUp
      ? differenceInDays(today, new Date(lastFollowUp.followUpDate))
      : null;

    // Color coding engine
    let colorCode: 'green' | 'blue' | 'amber' | 'red' = 'green';
    if (invoice.status === 'OVERDUE') colorCode = 'red';
    else if (invoice.status === 'DUE_TODAY') colorCode = 'amber';
    else if (daysToDue !== null && daysToDue <= 7) colorCode = 'blue';

    return {
      ...invoice,
      daysOverdue,
      daysToDue,
      daysSinceFollowUp,
      colorCode,
      followUpAlert: daysSinceFollowUp !== null && daysSinceFollowUp > 5,
    };
  }
}
