'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Plus, Download, FileText } from 'lucide-react';
import { useInvoices, useMarkPaid } from '@/lib/hooks/useApi';
import {
  Badge, GhostButton, EmptyState, PageHeader, Toolbar, Button, ResponsiveTable, Column,
} from '@/components/ui';
import { fmtCurrency, fmtDate, getStatusClass, getStatusLabel, getPdiColor, getFollowUpColor } from '@/lib/utils';
import { InvoiceStatus, Invoice } from '@/types';
import { NewInvoiceModal } from '@/components/forms/NewInvoiceModal';
import { InvoiceDrawer }   from '@/components/forms/InvoiceDrawer';

const STATUS_OPTIONS: { label: string; value: InvoiceStatus | '' }[] = [
  { label: 'All Status',    value: '' },
  { label: 'Overdue',       value: 'OVERDUE' },
  { label: 'Due Today',     value: 'DUE_TODAY' },
  { label: 'Pending',       value: 'PENDING' },
  { label: 'Partially Paid',value: 'PARTIALLY_PAID' },
  { label: 'Paid',          value: 'PAID' },
];

function exportCsv(invoices: Invoice[]) {
  const header = ['Invoice Number', 'Client', 'Amount', 'Outstanding', 'Currency', 'Invoice Date', 'Due Date', 'Status', 'Days Overdue', 'Last Follow-up (days)', 'PDI'];
  const rows = invoices.map(inv => [
    inv.invoiceNumber, inv.client?.name ?? '', inv.invoiceAmount, inv.remainingBalance, inv.currency,
    inv.invoiceDate.split('T')[0], inv.dueDate.split('T')[0], inv.status,
    inv.daysOverdue ?? '', inv.daysSinceFollowUp ?? '', Math.round(Number(inv.client?.paymentDisciplineIndex ?? 0)),
  ]);
  const csv = [header, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `stalker-invoices-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

const PAGE_SIZE = 20;

export default function InvoicesPage() {
  const searchParams = useSearchParams();
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState<InvoiceStatus | ''>('');
  const [page,     setPage]     = useState(1);
  const [newOpen,  setNewOpen]  = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const markPaid = useMarkPaid();

  useEffect(() => {
    const s = searchParams.get('status') as InvoiceStatus | null;
    if (s && STATUS_OPTIONS.some(o => o.value === s)) setStatus(s);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading } = useInvoices({ search: search || undefined, status: status || undefined, page, limit: PAGE_SIZE });
  const invoices: Invoice[] = data?.data ?? [];
  const meta = data?.meta;

  const columns: Column<Invoice>[] = [
    { key: 'client', header: 'Client', primary: true, render: inv => inv.client?.name ?? '—' },
    { key: 'invoiceNumber', header: 'Invoice', render: inv => <span className="mono text-[11px]" style={{ color: 'var(--text-3)' }}>{inv.invoiceNumber}</span> },
    { key: 'invoiceAmount', header: 'Amount', align: 'right', render: inv => <span className="mono">{fmtCurrency(Number(inv.invoiceAmount))}</span> },
    { key: 'remaining', header: 'Outstanding', align: 'right', render: inv => {
        const remaining = Number(inv.remainingBalance ?? 0);
        const isPaid = inv.status === 'PAID' || remaining <= 0;
        return <span className="mono font-bold" style={{ color: isPaid ? 'var(--green)' : 'var(--red)' }}>{isPaid ? '—' : fmtCurrency(remaining)}</span>;
      } },
    { key: 'invoiceDate', header: 'Issued', hideOnMobile: true, render: inv => fmtDate(inv.invoiceDate) },
    { key: 'dueDate', header: 'Due', render: inv => fmtDate(inv.dueDate) },
    { key: 'status', header: 'Status', render: inv => (
        <Badge className={getStatusClass(inv.status)}>{getStatusLabel(inv.status)}{inv.daysOverdue ? ` +${inv.daysOverdue}d` : ''}</Badge>
      ) },
    { key: 'followup', header: 'Follow-up', hideOnMobile: true, render: inv => (
        inv.daysSinceFollowUp != null
          ? <span className="mono font-semibold" style={{ color: getFollowUpColor(inv.daysSinceFollowUp) }}>{inv.daysSinceFollowUp}d ago</span>
          : <span style={{ color: 'var(--text-3)' }}>—</span>
      ) },
    { key: 'pdi', header: 'PDI', align: 'right', render: inv => {
        const pdi = Number(inv.client?.paymentDisciplineIndex ?? 0);
        return <span className="mono font-bold" style={{ color: getPdiColor(pdi) }}>{Math.round(pdi)}</span>;
      } },
  ];

  const rowActions = (inv: Invoice) => (
    inv.status !== 'PAID' && inv.status !== 'CANCELLED'
      ? <button onClick={() => markPaid.mutate({ id: inv.id })} disabled={markPaid.isPending}
          className="chip" style={{ minHeight: 32, color: 'var(--green)' }}>Mark Paid</button>
      : null
  );

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader title="Invoices" subtitle="Receivables across all clients"
          actions={<>
            <GhostButton onClick={() => invoices.length > 0 && exportCsv(invoices)} disabled={invoices.length === 0}>
              <Download size={12} className="inline mr-1" />Export
            </GhostButton>
            <Button onClick={() => setNewOpen(true)} blockMobile><Plus size={15} /> New Invoice</Button>
          </>} />

        <Toolbar className="mb-4">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Search invoice, client…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-input sm:w-44" value={status} onChange={e => { setStatus(e.target.value as InvoiceStatus | ''); setPage(1); }}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Toolbar>

        <ResponsiveTable columns={columns} rows={invoices} loading={isLoading} onRowClick={inv => setDrawerId(inv.id)} rowActions={rowActions}
          empty={<div className="card"><EmptyState icon={<FileText size={32} />} title="No invoices found" sub="Adjust filters or create a new invoice" /></div>} />

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs flex-wrap gap-2">
            <span style={{ color: 'var(--text-3)' }}>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, meta.total)} of {meta.total}
            </span>
            <div className="flex items-center gap-1">
              <GhostButton onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</GhostButton>
              <GhostButton onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}>Next →</GhostButton>
            </div>
          </div>
        )}
      </div>
      <NewInvoiceModal open={newOpen} onClose={() => setNewOpen(false)} />
      <InvoiceDrawer   invoiceId={drawerId} onClose={() => setDrawerId(null)} />
    </>
  );
}
