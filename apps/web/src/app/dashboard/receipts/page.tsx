'use client';

import { useState } from 'react';
import { Search, Plus, Receipt as ReceiptIcon, X } from 'lucide-react';
import { useReceipts, useReceipt } from '@/lib/hooks/useReceipts';
import { PageHeader, Toolbar, Button, GhostButton, EmptyState, Badge, ResponsiveTable, Column } from '@/components/ui';
import { fmtCurrency, fmtDate, fmtDateTime, getStatusClass, getStatusLabel } from '@/lib/utils';
import { NewReceiptModal } from '@/components/forms/NewReceiptModal';

const PAGE_SIZE = 20;

// ── Receipt detail modal ─────────────────────────────────────────────────────
function ReceiptDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: r, isLoading } = useReceipt(id);
  if (!id) return null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="animate-scale-in w-full max-w-2xl rounded-xl"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <ReceiptIcon size={15} style={{ color: 'var(--indigo-2)' }} />
            <span className="text-sm font-semibold mono" style={{ color: 'var(--text)' }}>{r?.reference ?? 'Receipt'}</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70" style={{ background: 'var(--bg-3)' }}>
            <X size={14} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {isLoading || !r ? (
          <p className="text-xs text-center py-12" style={{ color: 'var(--text-3)' }}>Loading…</p>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['Client', r.client?.name], ['Payment date', fmtDate(r.paymentDate)],
                ['Method', r.paymentMethod?.replace('_', ' ') ?? '—'], ['Reference', r.paymentReference ?? '—'],
                ['Recorded by', r.createdBy?.name ?? '—'], ['Recorded at', fmtDateTime(r.createdAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--bg-2)' }}>
                  <span style={{ color: 'var(--text-3)' }}>{k}</span>
                  <span className="font-medium text-right" style={{ color: 'var(--text)' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-4 gap-2">
              {[
                ['Outstanding before', r.outstandingBefore, 'var(--text)'],
                ['Total received', r.totalAmount, 'var(--text)'],
                ['Allocated', r.allocatedAmount, '#10B981'],
                ['Unallocated', r.unallocatedAmount, r.unallocatedAmount > 0 ? '#F59E0B' : 'var(--text-3)'],
              ].map(([k, v, col]) => (
                <div key={k as string} className="p-2.5 rounded-lg text-center" style={{ background: 'var(--bg-2)' }}>
                  <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{k}</p>
                  <p className="mono text-xs font-bold" style={{ color: col as string }}>{fmtCurrency(v as number)}</p>
                </div>
              ))}
            </div>

            {/* Allocations */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>Invoice Allocations</p>
              <div className="rounded-xl overflow-hidden overflow-x-auto" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-xs" style={{ minWidth: 480 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                      {['Invoice', 'Date', 'Allocated', 'Balance', 'Status'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(r.allocations ?? []).map((a: any) => (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-3 py-2 mono" style={{ color: 'var(--text-2)' }}>{a.invoice?.invoiceNumber ?? '—'}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-3)' }}>{fmtDate(a.invoice?.invoiceDate)}</td>
                        <td className="px-3 py-2 mono font-bold" style={{ color: '#10B981' }}>{fmtCurrency(a.amount)}</td>
                        <td className="px-3 py-2 mono" style={{ color: 'var(--text-2)' }}>{fmtCurrency(a.invoice?.remainingBalance ?? 0)}</td>
                        <td className="px-3 py-2">{a.invoice && <Badge className={getStatusClass(a.invoice.status)}>{getStatusLabel(a.invoice.status)}</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] mt-2" style={{ color: 'var(--text-3)' }}>
                Allocations are recorded as invoice payments — visible in each invoice's payment history.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReceiptsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useReceipts({ search: search || undefined, page, limit: PAGE_SIZE });
  const receipts = (data as any)?.data ?? [];
  const meta = (data as any)?.meta;

  const columns: Column<any>[] = [
    { key: 'reference', header: 'Receipt', primary: true, render: r => <span className="mono font-medium" style={{ color: 'var(--text)' }}>{r.reference}</span> },
    { key: 'client', header: 'Client', render: r => r.client?.name ?? '—' },
    { key: 'date', header: 'Date', hideOnMobile: true, render: r => fmtDate(r.paymentDate) },
    { key: 'total', header: 'Received', align: 'right', render: r => <span className="mono font-semibold">{fmtCurrency(r.totalAmount)}</span> },
    { key: 'allocated', header: 'Allocated', align: 'right', hideOnMobile: true, render: r => <span className="mono" style={{ color: '#10B981' }}>{fmtCurrency(r.allocatedAmount)}</span> },
    { key: 'unallocated', header: 'Unalloc.', align: 'right', hideOnMobile: true, render: r => <span className="mono" style={{ color: r.unallocatedAmount > 0 ? '#F59E0B' : 'var(--text-3)' }}>{fmtCurrency(r.unallocatedAmount)}</span> },
    { key: 'count', header: 'Invoices', align: 'right', render: r => <span className="mono" style={{ color: 'var(--text-3)' }}>{r._count?.allocations ?? 0}</span> },
  ];

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader title="Receipts" subtitle="Client payments allocated across outstanding invoices"
          actions={<Button onClick={() => setNewOpen(true)} blockMobile><Plus size={15} /> New Receipt</Button>} />

        <Toolbar className="mb-4">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Search receipt, client, ref…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </Toolbar>

        <ResponsiveTable columns={columns} rows={receipts} loading={isLoading} onRowClick={r => setDetailId(r.id)}
          empty={<div className="card"><EmptyState icon={<ReceiptIcon size={32} />} title="No receipts yet" sub="Record a client payment to allocate it across invoices" /></div>} />

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs flex-wrap gap-2">
            <span style={{ color: 'var(--text-3)' }}>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, meta.total)} of {meta.total}</span>
            <div className="flex items-center gap-1">
              <GhostButton onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</GhostButton>
              <GhostButton onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}>Next →</GhostButton>
            </div>
          </div>
        )}
      </div>

      <NewReceiptModal open={newOpen} onClose={() => setNewOpen(false)} />
      <ReceiptDetail id={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}
