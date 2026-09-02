import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { AuditService } from '../../common/services/audit.service';
import { makeReference } from '../../common/utils/reference.util';
import { PreviewReceiptDto, CreateReceiptDto, ReceiptQueryDto } from './dto/receipt.dto';

const EPS = 0.005;
/** Invoice statuses that still carry an outstanding balance. */
const OUTSTANDING_STATUSES: InvoiceStatus[] = ['PENDING', 'DUE_TODAY', 'OVERDUE', 'PARTIALLY_PAID'];

export interface AllocationLine {
  invoiceId:         string;
  invoiceNumber:     string;
  invoiceDate:       Date;
  currency:          string;
  invoiceAmount:     number;
  previousPaid:      number;
  previousRemaining: number;
  allocated:         number;
  newPaid:           number;
  newRemaining:      number;
  previousStatus:    InvoiceStatus;
  newStatus:         InvoiceStatus;
  settled:           boolean;
}

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Pure, sequential oldest→newest allocation. Never over-allocates: each line is
   * capped at the invoice's remaining balance, and the running total is capped at
   * the payment amount. Any excess is returned as `unallocated`.
   */
  private computeAllocations(invoices: any[], amount: number) {
    let remaining = amount;
    let outstandingBefore = 0;

    const lines: AllocationLine[] = invoices.map(inv => {
      const invoiceAmount     = Number(inv.invoiceAmount);
      const previousPaid      = Number(inv.amountPaid ?? 0);
      const previousRemaining = Number(inv.remainingBalance ?? (invoiceAmount - previousPaid));
      outstandingBefore += Math.max(0, previousRemaining);

      let allocated = 0;
      if (previousRemaining > EPS && remaining > EPS) {
        allocated = +Math.min(remaining, previousRemaining).toFixed(2);
        remaining = +(remaining - allocated).toFixed(2);
      }

      const newPaid      = +(previousPaid + allocated).toFixed(2);
      const newRemaining = +Math.max(0, invoiceAmount - newPaid).toFixed(2);
      const settled      = newRemaining <= EPS;
      const newStatus: InvoiceStatus =
        allocated <= EPS ? inv.status : settled ? 'PAID' : 'PARTIALLY_PAID';

      return {
        invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, invoiceDate: inv.invoiceDate,
        currency: inv.currency, invoiceAmount, previousPaid, previousRemaining,
        allocated, newPaid, newRemaining, previousStatus: inv.status, newStatus, settled,
      };
    });

    return {
      lines,
      allocated:         +(amount - remaining).toFixed(2),
      unallocated:       +remaining.toFixed(2),
      outstandingBefore: +outstandingBefore.toFixed(2),
    };
  }

  private outstandingInvoices(clientId: string, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    return tx.invoice.findMany({
      where:   { clientId, status: { in: OUTSTANDING_STATUSES } },
      orderBy: [{ invoiceDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  private async requireClient(clientId: string, organizationId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  // ── OUTSTANDING (view step) ─────────────────────────────────────────────────
  async getOutstanding(clientId: string, organizationId: string) {
    const client = await this.requireClient(clientId, organizationId);
    const invoices = await this.outstandingInvoices(clientId);
    const totalOutstanding = invoices.reduce(
      (s, inv) => s + Number(inv.remainingBalance ?? (Number(inv.invoiceAmount) - Number(inv.amountPaid ?? 0))), 0,
    );
    return {
      client: { id: client.id, name: client.name, email: client.email, companyRegistration: client.companyRegistration },
      totalOutstanding: +totalOutstanding.toFixed(2),
      count: invoices.length,
      invoices: invoices.map(inv => ({
        id: inv.id, invoiceNumber: inv.invoiceNumber, invoiceDate: inv.invoiceDate, dueDate: inv.dueDate,
        currency: inv.currency, invoiceAmount: Number(inv.invoiceAmount), amountPaid: Number(inv.amountPaid ?? 0),
        remainingBalance: Number(inv.remainingBalance ?? (Number(inv.invoiceAmount) - Number(inv.amountPaid ?? 0))),
        status: inv.status,
      })),
    };
  }

  // ── PREVIEW (consolidate calculation, no persistence) ──────────────────────
  async preview(dto: PreviewReceiptDto, organizationId: string) {
    const client = await this.requireClient(dto.clientId, organizationId);
    const invoices = await this.outstandingInvoices(dto.clientId);
    const { lines, allocated, unallocated, outstandingBefore } = this.computeAllocations(invoices, dto.amount);

    return {
      client: { id: client.id, name: client.name, email: client.email, companyRegistration: client.companyRegistration },
      paymentDate:      new Date(),
      totalAmount:      +dto.amount.toFixed(2),
      outstandingBefore,
      allocatedAmount:  allocated,
      unallocatedAmount: unallocated,
      allocations:      lines,
    };
  }

  // ── CREATE (atomic apply) ───────────────────────────────────────────────────
  async create(dto: CreateReceiptDto, userId: string, organizationId: string) {
    const client = await this.requireClient(dto.clientId, organizationId);
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

    // Everything that touches invoice balances happens inside one interactive
    // transaction, so a failure leaves no invoice partially updated.
    const result = await this.prisma.$transaction(async (tx) => {
      const invoices = await this.outstandingInvoices(dto.clientId, tx);
      const { lines, allocated, unallocated, outstandingBefore } = this.computeAllocations(invoices, dto.amount);
      const currency = invoices[0]?.currency ?? 'NGN';

      const receipt = await tx.receipt.create({
        data: {
          organizationId,
          reference:         makeReference('RCP'),
          clientId:          dto.clientId,
          paymentDate,
          totalAmount:       dto.amount,
          allocatedAmount:   allocated,
          unallocatedAmount: unallocated,
          outstandingBefore,
          currency,
          paymentMethod:     dto.paymentMethod,
          paymentReference:  dto.paymentReference,
          notes:             dto.notes,
          createdById:       userId,
        },
      });

      const settledInvoiceIds: string[] = [];
      for (const line of lines) {
        if (line.allocated <= EPS) continue;
        // Same invoice fields the existing settlement writes — via the same data model.
        await tx.invoice.update({
          where: { id: line.invoiceId },
          data: {
            amountPaid:       line.newPaid,
            remainingBalance: line.newRemaining,
            paidAmount:       line.newPaid,
            status:           line.newStatus,
            ...(line.settled ? { paidDate: paymentDate } : {}),
          },
        });
        await tx.paymentRecord.create({
          data: {
            invoiceId:  line.invoiceId,
            paidBy:     userId,
            receiptId:  receipt.id,
            amount:     line.allocated,
            paymentDate,
            notes:      `Auto-allocated from receipt ${receipt.reference}`,
            isReverted: false,
          },
        });
        if (line.settled) settledInvoiceIds.push(line.invoiceId);
      }

      return { receipt, lines, allocated, unallocated, outstandingBefore, settledInvoiceIds };
    });

    // Post-commit side effects — identical to the existing settlement path.
    if (result.settledInvoiceIds.length) {
      await this.prisma.slaViolation.updateMany({
        where: { invoiceId: { in: result.settledInvoiceIds }, resolved: false },
        data:  { resolved: true, resolvedAt: new Date() },
      });
    }
    await this.clientsService.recalculatePDI(dto.clientId);

    await this.audit.record({
      userId, action: 'RECEIPT_CREATED', entity: 'Receipt', entityId: result.receipt.id,
      newValues: {
        reference:   result.receipt.reference,
        client:      client.name,
        totalAmount: dto.amount,
        allocated:   result.allocated,
        unallocated: result.unallocated,
        allocations: result.lines.filter(l => l.allocated > EPS).map(l => ({
          invoice: l.invoiceNumber, allocated: l.allocated, newStatus: l.newStatus,
        })),
      },
    });

    this.logger.log(
      `Receipt ${result.receipt.reference}: ₦${dto.amount} for ${client.name} → ` +
      `allocated ₦${result.allocated} across ${result.settledInvoiceIds.length + result.lines.filter(l => l.allocated > EPS && !l.settled).length} invoice(s), unallocated ₦${result.unallocated}`,
    );

    return this.findOne(result.receipt.id, organizationId);
  }

  // ── LIST ────────────────────────────────────────────────────────────────────
  async findAll(organizationId: string, query: ReceiptQueryDto) {
    const { page = 1, limit = 20, clientId, search } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.ReceiptWhereInput = {
      organizationId,
      ...(clientId && { clientId }),
      ...(search && {
        OR: [
          { reference: { contains: search, mode: 'insensitive' } },
          { client:    { name: { contains: search, mode: 'insensitive' } } },
          { paymentReference: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.receipt.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          client:    { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          _count:    { select: { allocations: true } },
        },
      }),
      this.prisma.receipt.count({ where }),
    ]);
    return {
      data: rows.map(r => this.serialize(r)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── SINGLE ──────────────────────────────────────────────────────────────────
  async findOne(id: string, organizationId: string) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id, organizationId },
      include: {
        client:    { select: { id: true, name: true, email: true, companyRegistration: true } },
        createdBy: { select: { id: true, name: true } },
        allocations: {
          orderBy: { createdAt: 'asc' },
          include: {
            invoice: { select: { id: true, invoiceNumber: true, invoiceDate: true, invoiceAmount: true, remainingBalance: true, status: true } },
          },
        },
      },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return this.serialize(receipt);
  }

  private serialize(receipt: any) {
    const out: any = { ...receipt };
    for (const f of ['totalAmount', 'allocatedAmount', 'unallocatedAmount', 'outstandingBefore']) {
      if (out[f] != null) out[f] = Number(out[f]);
    }
    if (Array.isArray(out.allocations)) {
      out.allocations = out.allocations.map((a: any) => ({
        ...a,
        amount: Number(a.amount),
        invoice: a.invoice ? {
          ...a.invoice,
          invoiceAmount:    Number(a.invoice.invoiceAmount),
          remainingBalance: a.invoice.remainingBalance != null ? Number(a.invoice.remainingBalance) : null,
        } : undefined,
      }));
    }
    return out;
  }
}
