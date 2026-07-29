import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { differenceInDays } from 'date-fns';
import { PrismaService } from '../../config/prisma.service';
import { ExposureService } from '../../common/services/exposure.service';
import { ReportPayload } from '../../common/services/export.service';

export interface ControlReportFilters {
  from?:       string;
  to?:         string;
  clientId?:   string;
  supplierId?: string;
  status?:     string;
  approverId?: string;
  accountId?:  string;
  currency?:   string;
  type?:       string;
}

const num = (v: any) => (v == null ? 0 : Number(v));
const dateOnly = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');

/**
 * Data providers for the financial-control-chain reports. Each method returns a
 * { title, columns, rows } payload the ExportService renders to CSV / XLSX / PDF.
 */
@Injectable()
export class ControlReportsService {
  constructor(
    private readonly prisma:   PrismaService,
    private readonly exposure: ExposureService,
  ) {}

  private dateRange(f: ControlReportFilters, field: string) {
    if (!f.from && !f.to) return {};
    return { [field]: { ...(f.from && { gte: new Date(f.from) }), ...(f.to && { lte: new Date(f.to) }) } };
  }

  // 1 ── Transaction Register ────────────────────────────────────────────────
  async transactionRegister(orgId: string, f: ControlReportFilters): Promise<ReportPayload> {
    const where: Prisma.TransactionWhereInput = {
      organizationId: orgId,
      ...(f.clientId && { clientId: f.clientId }),
      ...(f.status   && { status: f.status as any }),
      ...(f.currency && { currency: f.currency }),
      ...this.dateRange(f, 'transactionDate'),
    };
    const rows = await this.prisma.transaction.findMany({
      where, orderBy: { transactionDate: 'desc' },
      include: { client: { select: { name: true } }, creditRequest: { select: { reference: true } }, salesRequest: { select: { reference: true } } },
    });
    return {
      title: 'Transaction Register',
      columns: [
        { key: 'reference', label: 'Reference', width: 14 },
        { key: 'srfNumber', label: 'SRF', width: 14 },
        { key: 'date', label: 'Date', width: 10, type: 'date' },
        { key: 'client', label: 'Client', width: 20 },
        { key: 'salesRef', label: 'Sales Ref', width: 12 },
        { key: 'creditRef', label: 'Credit Ref', width: 12 },
        { key: 'value', label: 'Value', width: 14, type: 'currency' },
        { key: 'supplierCost', label: 'Supplier Cost', width: 14, type: 'currency' },
        { key: 'grossMargin', label: 'Gross Margin', width: 14, type: 'currency' },
        { key: 'profit', label: 'Profit %', width: 8, type: 'number' },
        { key: 'exposure', label: 'Post Exposure', width: 14, type: 'currency' },
        { key: 'status', label: 'Status', width: 12 },
        { key: 'fulfilment', label: 'Fulfilment', width: 12 },
        { key: 'currency', label: 'Ccy', width: 6 },
      ],
      rows: rows.map(t => ({
        reference: t.reference, srfNumber: t.srfNumber ?? '', date: dateOnly(t.transactionDate),
        client: t.client.name, salesRef: t.salesRequest?.reference ?? '', creditRef: t.creditRequest?.reference ?? '',
        value: num(t.newTransactionValue), supplierCost: num(t.supplierCost), grossMargin: num(t.grossMargin),
        profit: num(t.profitPercentage), exposure: num(t.postTransactionExposure),
        status: t.status, fulfilment: t.fulfilmentStatus, currency: t.currency,
      })),
    };
  }

  // 2 ── Exposure Report ──────────────────────────────────────────────────────
  async exposureReport(orgId: string, f: ControlReportFilters): Promise<ReportPayload> {
    const clients = await this.prisma.client.findMany({
      where: { organizationId: orgId, ...(f.clientId && { id: f.clientId }) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, riskStatus: true, isBlocked: true, creditLimit: true },
    });

    const rows = [];
    for (const c of clients) {
      const exp = await this.exposure.getClientExposure(c.id);
      const activeTxn = await this.prisma.transaction.aggregate({
        where: { clientId: c.id, status: { in: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ON_HOLD'] } },
        _sum: { newTransactionValue: true },
      });
      const pipeline = num(activeTxn._sum.newTransactionValue);
      rows.push({
        client: c.name, riskStatus: c.riskStatus, blocked: c.isBlocked ? 'Yes' : 'No',
        creditLimit: exp.creditLimit, currentExposure: exp.currentExposure,
        pipelineValue: pipeline, projectedExposure: +(exp.currentExposure + pipeline).toFixed(2),
        availableCredit: exp.availableCredit, utilization: exp.utilizationPercent,
        overLimit: exp.creditLimit > 0 && exp.currentExposure + pipeline > exp.creditLimit ? 'Yes' : 'No',
      });
    }
    return {
      title: 'Client Exposure Report',
      columns: [
        { key: 'client', label: 'Client', width: 22 },
        { key: 'riskStatus', label: 'Risk', width: 10 },
        { key: 'blocked', label: 'Blocked', width: 8 },
        { key: 'creditLimit', label: 'Credit Limit', width: 14, type: 'currency' },
        { key: 'currentExposure', label: 'Current Exposure', width: 15, type: 'currency' },
        { key: 'pipelineValue', label: 'Pipeline Value', width: 14, type: 'currency' },
        { key: 'projectedExposure', label: 'Projected Exposure', width: 16, type: 'currency' },
        { key: 'availableCredit', label: 'Available Credit', width: 15, type: 'currency' },
        { key: 'utilization', label: 'Util %', width: 8, type: 'number' },
        { key: 'overLimit', label: 'Over Limit', width: 9 },
      ],
      rows,
    };
  }

  // 3 ── Approval Report ──────────────────────────────────────────────────────
  async approvalReport(orgId: string, f: ControlReportFilters): Promise<ReportPayload> {
    const where: Prisma.TransactionApprovalWhereInput = {
      transaction: { organizationId: orgId },
      ...(f.approverId && { approverId: f.approverId }),
      ...(f.status && { decision: f.status as any }),
      ...this.dateRange(f, 'createdAt'),
    };
    const rows = await this.prisma.transactionApproval.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { transaction: { select: { reference: true, newTransactionValue: true } }, approver: { select: { name: true } } },
    });
    return {
      title: 'Approval Report',
      columns: [
        { key: 'transaction', label: 'Transaction', width: 16 },
        { key: 'value', label: 'Value', width: 14, type: 'currency' },
        { key: 'level', label: 'Level', width: 6, type: 'number' },
        { key: 'decision', label: 'Decision', width: 10 },
        { key: 'approver', label: 'Approver', width: 18 },
        { key: 'role', label: 'Role', width: 10 },
        { key: 'comments', label: 'Comments', width: 24 },
        { key: 'date', label: 'Date', width: 10, type: 'date' },
      ],
      rows: rows.map(a => ({
        transaction: a.transaction.reference, value: num(a.transaction.newTransactionValue),
        level: a.level, decision: a.decision, approver: a.approver?.name ?? '—', role: a.approverRole ?? '',
        comments: a.comments ?? '', date: dateOnly(a.createdAt),
      })),
    };
  }

  // 4 ── Supplier Cost Analysis ───────────────────────────────────────────────
  async supplierCostAnalysis(orgId: string, f: ControlReportFilters): Promise<ReportPayload> {
    const suppliers = await this.prisma.supplier.findMany({
      where: { organizationId: orgId, ...(f.supplierId && { id: f.supplierId }) },
      orderBy: { name: 'asc' },
    });
    const rows = [];
    for (const s of suppliers) {
      const prWhere: Prisma.PaymentRequestWhereInput = { supplierId: s.id, ...this.dateRange(f, 'createdAt') };
      const [agg, paidAgg, count] = await Promise.all([
        this.prisma.paymentRequest.aggregate({ where: prWhere, _sum: { requestedAmount: true } }),
        this.prisma.paymentRequest.aggregate({ where: { ...prWhere, status: 'PAID' }, _sum: { paymentAmount: true } }),
        this.prisma.paymentRequest.count({ where: prWhere }),
      ]);
      rows.push({
        supplier: s.name, code: s.code ?? '', requests: count,
        totalRequested: num(agg._sum.requestedAmount), totalPaid: num(paidAgg._sum.paymentAmount),
        active: s.isActive ? 'Yes' : 'No',
      });
    }
    return {
      title: 'Supplier Cost Analysis',
      columns: [
        { key: 'supplier', label: 'Supplier', width: 24 },
        { key: 'code', label: 'Code', width: 12 },
        { key: 'requests', label: 'Requests', width: 9, type: 'number' },
        { key: 'totalRequested', label: 'Total Requested', width: 16, type: 'currency' },
        { key: 'totalPaid', label: 'Total Paid', width: 15, type: 'currency' },
        { key: 'active', label: 'Active', width: 8 },
      ],
      rows,
    };
  }

  // 5 ── Payment Register ─────────────────────────────────────────────────────
  async paymentRegister(orgId: string, f: ControlReportFilters): Promise<ReportPayload> {
    const where: Prisma.PaymentRequestWhereInput = {
      organizationId: orgId,
      ...(f.supplierId && { supplierId: f.supplierId }),
      ...(f.accountId && { operationalAccountId: f.accountId }),
      ...(f.status && { status: f.status as any }),
      ...(f.currency && { currency: f.currency }),
      ...this.dateRange(f, 'createdAt'),
    };
    const rows = await this.prisma.paymentRequest.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { name: true } },
        operationalAccount: { select: { name: true } },
        transaction: { select: { reference: true, srfNumber: true } },
        approvedBy: { select: { name: true } },
      },
    });
    return {
      title: 'Payment Register',
      columns: [
        { key: 'reference', label: 'Reference', width: 14 },
        { key: 'transaction', label: 'Transaction', width: 14 },
        { key: 'srf', label: 'SRF', width: 12 },
        { key: 'supplier', label: 'Supplier', width: 20 },
        { key: 'account', label: 'Account', width: 16 },
        { key: 'requested', label: 'Requested', width: 14, type: 'currency' },
        { key: 'paid', label: 'Paid', width: 14, type: 'currency' },
        { key: 'currency', label: 'Ccy', width: 6 },
        { key: 'method', label: 'Method', width: 12 },
        { key: 'status', label: 'Status', width: 12 },
        { key: 'paymentDate', label: 'Paid On', width: 10, type: 'date' },
        { key: 'confirmation', label: 'Confirmation', width: 14 },
        { key: 'approvedBy', label: 'Approved By', width: 16 },
      ],
      rows: rows.map(p => ({
        reference: p.reference, transaction: p.transaction.reference, srf: p.transaction.srfNumber ?? '',
        supplier: p.supplier.name, account: p.operationalAccount?.name ?? '',
        requested: num(p.requestedAmount), paid: num(p.paymentAmount), currency: p.currency,
        method: p.paymentMethod ?? '', status: p.status, paymentDate: dateOnly(p.paymentDate),
        confirmation: p.confirmationReference ?? '', approvedBy: p.approvedBy?.name ?? '',
      })),
    };
  }

  // 6 ── Outstanding Payments ─────────────────────────────────────────────────
  async outstandingPayments(orgId: string, f: ControlReportFilters): Promise<ReportPayload> {
    const where: Prisma.PaymentRequestWhereInput = {
      organizationId: orgId,
      status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING'] },
      ...(f.supplierId && { supplierId: f.supplierId }),
      ...(f.accountId && { operationalAccountId: f.accountId }),
    };
    const rows = await this.prisma.paymentRequest.findMany({
      where, orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      include: { supplier: { select: { name: true } }, transaction: { select: { reference: true } } },
    });
    const today = new Date();
    return {
      title: 'Outstanding Payments',
      columns: [
        { key: 'reference', label: 'Reference', width: 14 },
        { key: 'supplier', label: 'Supplier', width: 22 },
        { key: 'transaction', label: 'Transaction', width: 16 },
        { key: 'amount', label: 'Amount', width: 14, type: 'currency' },
        { key: 'currency', label: 'Ccy', width: 6 },
        { key: 'status', label: 'Status', width: 14 },
        { key: 'dueDate', label: 'Due Date', width: 10, type: 'date' },
        { key: 'daysOverdue', label: 'Days Overdue', width: 10, type: 'number' },
        { key: 'replenishment', label: 'Replenish?', width: 10 },
      ],
      rows: rows.map(p => ({
        reference: p.reference, supplier: p.supplier.name, transaction: p.transaction.reference,
        amount: num(p.requestedAmount), currency: p.currency, status: p.status, dueDate: dateOnly(p.dueDate),
        daysOverdue: p.dueDate && p.dueDate < today ? differenceInDays(today, p.dueDate) : 0,
        replenishment: p.replenishmentRequired ? 'Yes' : 'No',
      })),
    };
  }

  // 7 ── Exception Report ─────────────────────────────────────────────────────
  async exceptionReport(orgId: string, f: ControlReportFilters): Promise<ReportPayload> {
    const where: Prisma.PaymentExceptionWhereInput = {
      organizationId: orgId,
      ...(f.status && { status: f.status as any }),
      ...(f.type && { type: f.type as any }),
      ...this.dateRange(f, 'createdAt'),
    };
    const rows = await this.prisma.paymentException.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: {
        paymentRequest: { select: { reference: true, supplier: { select: { name: true } } } },
        resolvedBy: { select: { name: true } },
      },
    });
    return {
      title: 'Payment Exception Report',
      columns: [
        { key: 'type', label: 'Type', width: 18 },
        { key: 'status', label: 'Status', width: 10 },
        { key: 'paymentRef', label: 'Payment Ref', width: 14 },
        { key: 'supplier', label: 'Supplier', width: 20 },
        { key: 'detail', label: 'Detail', width: 30 },
        { key: 'createdAt', label: 'Raised', width: 10, type: 'date' },
        { key: 'resolvedBy', label: 'Resolved By', width: 16 },
        { key: 'resolvedAt', label: 'Resolved', width: 10, type: 'date' },
      ],
      rows: rows.map(e => ({
        type: e.type, status: e.status, paymentRef: e.paymentRequest?.reference ?? '',
        supplier: e.paymentRequest?.supplier?.name ?? '', detail: e.detail ?? '',
        createdAt: dateOnly(e.createdAt), resolvedBy: e.resolvedBy?.name ?? '', resolvedAt: dateOnly(e.resolvedAt),
      })),
    };
  }

  // 8 ── Replenishment Report ─────────────────────────────────────────────────
  async replenishmentReport(orgId: string, f: ControlReportFilters): Promise<ReportPayload> {
    const where: Prisma.ReplenishmentWhereInput = {
      organizationId: orgId,
      ...(f.status && { status: f.status as any }),
      ...(f.accountId && { operationalAccountId: f.accountId }),
      ...this.dateRange(f, 'createdAt'),
    };
    const rows = await this.prisma.replenishment.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: {
        operationalAccount: { select: { name: true, currency: true } },
        requestedBy: { select: { name: true } },
        decisionBy: { select: { name: true } },
      },
    });
    return {
      title: 'Replenishment Report',
      columns: [
        { key: 'reference', label: 'Reference', width: 14 },
        { key: 'account', label: 'Account', width: 18 },
        { key: 'required', label: 'Required', width: 14, type: 'currency' },
        { key: 'requested', label: 'Requested', width: 14, type: 'currency' },
        { key: 'approved', label: 'Approved', width: 14, type: 'currency' },
        { key: 'currency', label: 'Ccy', width: 6 },
        { key: 'status', label: 'Status', width: 10 },
        { key: 'requestedBy', label: 'Requested By', width: 16 },
        { key: 'decisionBy', label: 'Decision By', width: 16 },
        { key: 'createdAt', label: 'Raised', width: 10, type: 'date' },
        { key: 'fundedAt', label: 'Funded', width: 10, type: 'date' },
      ],
      rows: rows.map(r => ({
        reference: r.reference, account: r.operationalAccount.name,
        required: num(r.requiredAmount), requested: num(r.requestedAmount),
        approved: r.approvedAmount != null ? num(r.approvedAmount) : '',
        currency: r.operationalAccount.currency, status: r.status,
        requestedBy: r.requestedBy?.name ?? '', decisionBy: r.decisionBy?.name ?? '',
        createdAt: dateOnly(r.createdAt), fundedAt: dateOnly(r.fundedAt),
      })),
    };
  }
}
