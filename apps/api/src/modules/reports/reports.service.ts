import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

export interface ReportFilters {
  from?:     string;
  to?:       string;
  status?:   string;
  clientId?: string;
  userId?:   string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Invoices report ────────────────────────────────────────────────────────
  async invoicesReport(orgId: string, filters: ReportFilters) {
    const where: any = {
      client: { organizationId: orgId },
      ...(filters.status   && { status: filters.status }),
      ...(filters.clientId && { clientId: filters.clientId }),
      ...(filters.from || filters.to) && {
        invoiceDate: {
          ...(filters.from && { gte: new Date(filters.from) }),
          ...(filters.to   && { lte: new Date(filters.to)   }),
        },
      },
    };

    const invoices = await this.prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: 'desc' },
      include: { client: { select: { name: true } } },
    });

    return invoices.map(inv => ({
      id:            inv.id,
      invoiceNumber: inv.invoiceNumber,
      client:        inv.client.name,
      amount:        Number(inv.invoiceAmount),
      amountPaid:    Number(inv.amountPaid),
      remaining:     Number(inv.remainingBalance ?? 0),
      currency:      inv.currency,
      status:        inv.status,
      invoiceDate:   inv.invoiceDate.toISOString().split('T')[0],
      dueDate:       inv.dueDate.toISOString().split('T')[0],
      paidDate:      inv.paidDate ? inv.paidDate.toISOString().split('T')[0] : '',
    }));
  }

  // ── Collections report ─────────────────────────────────────────────────────
  async collectionsReport(orgId: string, filters: ReportFilters) {
    const where: any = {
      isReverted: false,
      invoice: { client: { organizationId: orgId } },
      ...(filters.from || filters.to) && {
        paymentDate: {
          ...(filters.from && { gte: new Date(filters.from) }),
          ...(filters.to   && { lte: new Date(filters.to)   }),
        },
      },
      ...(filters.userId && { paidBy: filters.userId }),
    };

    const payments = await this.prisma.paymentRecord.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        invoice: { include: { client: { select: { name: true } } } },
        user:    { select: { name: true } },
      },
    });

    return payments.map(p => ({
      id:            p.id,
      invoiceNumber: p.invoice.invoiceNumber,
      client:        p.invoice.client.name,
      amount:        Number(p.amount),
      currency:      p.invoice.currency,
      paymentDate:   p.paymentDate.toISOString().split('T')[0],
      recordedBy:    p.user?.name ?? 'System',
      notes:         p.notes ?? '',
    }));
  }

  // ── Clients report ─────────────────────────────────────────────────────────
  async clientsReport(orgId: string, filters: ReportFilters) {
    const clients = await this.prisma.client.findMany({
      where: {
        organizationId: orgId,
        ...(filters.from || filters.to) && {
          createdAt: {
            ...(filters.from && { gte: new Date(filters.from) }),
            ...(filters.to   && { lte: new Date(filters.to)   }),
          },
        },
      },
      orderBy: { paymentDisciplineIndex: 'asc' },
      include: {
        _count: { select: { invoices: true, slaViolations: true } },
      },
    });

    return clients.map(c => ({
      id:          c.id,
      name:        c.name,
      sector:      c.sector ?? '',
      creditLimit: Number(c.creditLimit),
      pdi:         Number(c.paymentDisciplineIndex),
      risk:        c.riskStatus,
      isBlocked:   c.isBlocked,
      slaDays:     c.slaDays,
      invoiceCount:  c._count.invoices,
      violations:    c._count.slaViolations,
      joinedDate:    c.createdAt.toISOString().split('T')[0],
    }));
  }

  // ── CSV builder ────────────────────────────────────────────────────────────
  buildCsv(rows: Record<string, any>[]): string {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const escape  = (v: any) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines = [
      headers.join(','),
      ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
    ];
    return lines.join('\r\n');
  }
}
