'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Plus, Download, FileText } from 'lucide-react';
import { useInvoices, useMarkPaid } from '@/lib/hooks/useApi';
import { SectionTitle, Badge, SkeletonTable, GhostButton, AmberButton, EmptyState } from '@/components/ui';
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
    inv.invoiceNumber,
    inv.client?.name ?? '',
    inv.invoiceAmount,
    inv.remainingBalance,
    inv.currency,
    inv.invoiceDate.split('T')[0],
    inv.dueDate.split('T')[0],
    inv.status,
    inv.daysOverdue ?? '',
    inv.daysSinceFollowUp ?? '',
    Math.round(Number(inv.client?.paymentDisciplineIndex ?? 0)),
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

  // Initialise status filter from URL param on mount (e.g. ?status=OVERDUE from dashboard)
  useEffect(() => {
    const s = searchParams.get('status') as InvoiceStatus | null;
    if (s && STATUS_OPTIONS.some(o => o.value === s)) {
      setStatus(s);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading } = useInvoices({
    search: search || undefined,
    status: status || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const invoices = data?.data ?? [];
  const meta     = data?.meta;

  return (
    <>
    <div className="space-y-4 animate-fade-in">

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input
            className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none w-56"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            placeholder="Search invoice, client…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          value={status}
          onChange={e => { setStatus(e.target.value as InvoiceStatus | ''); setPage(1); }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div className="flex-1" />
        <GhostButton onClick={() => invoices.length > 0 && exportCsv(invoices)} disabled={invoices.length === 0}>
          <Download size={12} className="inline mr-1" />Export CSV
        </GhostButton>
        <AmberButton onClick={() => setNewOpen(true)}>
          <Plus size={12} className="inline mr-1" />New Invoice
        </AmberButton>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? <SkeletonTable rows={8} /> : invoices.length === 0 ? (
          <EmptyState icon={<FileText size={32} />} title="No invoices found" sub="Adjust filters or create a new invoice" />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Invoice ID', 'Client', 'Amount', 'Outstanding', 'Issue Date', 'Due Date', 'Status', 'Follow-up', 'PDI', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium uppercase tracking-wide text-[10px]" style={{ color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: Invoice) => {
                const flColor  = inv.daysSinceFollowUp != null ? getFollowUpColor(inv.daysSinceFollowUp) : 'var(--text-3)';
                const pdi      = Number(inv.client?.paymentDisciplineIndex ?? 0);
                const remaining = Number(inv.remainingBalance ?? 0);
                const isPaid   = inv.status === 'PAID' || remaining <= 0;
                return (
                  <tr key={inv.id} onClick={() => setDrawerId(inv.id)}
                    className="border-b transition-colors cursor-pointer hover:opacity-90"
                    style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3 mono text-[11px]" style={{ color: 'var(--text-3)' }}>{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{inv.client?.name ?? '—'}</td>
                    <td className="px-4 py-3 mono font-semibold" style={{ color: 'var(--text)' }}>{fmtCurrency(Number(inv.invoiceAmount))}</td>
                    <td className="px-4 py-3 mono font-bold" style={{ color: isPaid ? 'var(--green)' : remaining > 0 ? 'var(--red)' : 'var(--text-3)' }}>
                      {isPaid ? '—' : fmtCurrency(remaining)}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-3)' }}>{fmtDate(inv.invoiceDate)}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-2)' }}>{fmtDate(inv.dueDate)}</td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusClass(inv.status)}>
                        {getStatusLabel(inv.status)}{inv.daysOverdue ? ` +${inv.daysOverdue}d` : ''}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 mono font-semibold" style={{ color: flColor }}>
                      {inv.daysSinceFollowUp != null ? `${inv.daysSinceFollowUp}d ago` : '—'}
                      {inv.followUpAlert && (
                        <span className="ml-1 text-[9px] px-1 py-0.5 rounded" style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>!</span>
                      )}
                    </td>
                    <td className="px-4 py-3 mono text-xs font-bold" style={{ color: getPdiColor(pdi) }}>{Math.round(pdi)}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                        <button onClick={() => markPaid.mutate({ id: inv.id })} disabled={markPaid.isPending}
                          className="px-2 py-1 rounded text-[10px] font-semibold transition-all hover:opacity-80"
                          style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text-3)' }}>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, meta.total)} of {meta.total} invoices
            </span>
            <div className="flex items-center gap-1">
              <GhostButton onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</GhostButton>
              {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                const pg = Math.max(1, Math.min(meta.totalPages - 4, page - 2)) + i;
                return pg <= meta.totalPages ? (
                  <button key={pg} onClick={() => setPage(pg)}
                    className="w-7 h-7 rounded text-[11px] font-medium transition-all"
                    style={{ background: pg === page ? 'var(--amber)' : 'transparent', color: pg === page ? '#000' : 'var(--text-3)' }}>
                    {pg}
                  </button>
                ) : null;
              })}
              <GhostButton onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}>Next →</GhostButton>
            </div>
          </div>
        )}
      </div>
    </div>
    <NewInvoiceModal open={newOpen} onClose={() => setNewOpen(false)} />
    <InvoiceDrawer   invoiceId={drawerId} onClose={() => setDrawerId(null)} />
    </>
  );
}
