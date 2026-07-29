'use client';

import { useState } from 'react';
import { Search, Plus, ShoppingCart } from 'lucide-react';
import { useSalesRequests, useSalesAction } from '@/lib/hooks/useControlChain';
import { useAuthStore } from '@/lib/store/auth.store';
import { SkeletonTable, GhostButton, AmberButton, EmptyState } from '@/components/ui';
import { fmtCurrency, fmtDate } from '@/lib/utils';
import { chainBadge } from '@/lib/utils/chain';
import { NewSalesRequestModal } from '@/components/forms/NewSalesRequestModal';

const STATUS_OPTIONS = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED'];
const PAGE_SIZE = 20;

export default function SalesPage() {
  const role = useAuthStore(s => s.user?.role);
  const canReview = role === 'ADMIN' || role === 'CFO' || role === 'FINANCE';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page,   setPage]   = useState(1);
  const [newOpen, setNewOpen] = useState(false);

  const { data, isLoading } = useSalesRequests({
    search: search || undefined, status: status || undefined, page, limit: PAGE_SIZE,
  });
  const action = useSalesAction();

  const rows = data?.data ?? [];
  const meta = data?.meta;

  const act = (a: string, id: string) => action.mutate({ action: a, id });

  return (
    <>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none w-56"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              placeholder="Search reference, title, client…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="px-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
          </select>
          <div className="flex-1" />
          <AmberButton onClick={() => setNewOpen(true)}>
            <Plus size={12} className="inline mr-1" />New Sales Request
          </AmberButton>
        </div>

        <div className="card overflow-hidden">
          {isLoading ? <SkeletonTable rows={8} /> : rows.length === 0 ? (
            <EmptyState icon={<ShoppingCart size={32} />} title="No sales requests" sub="Create one to start the control chain" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 720 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Reference', 'Client', 'Title', 'Amount', 'Created', 'Status', 'Chain', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium uppercase tracking-wide text-[10px]" style={{ color: 'var(--text-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => {
                    const b = chainBadge(r.status);
                    return (
                      <tr key={r.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-4 py-3 mono text-[11px]" style={{ color: 'var(--text-3)' }}>{r.reference}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{r.client?.name ?? '—'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-2)' }}>{r.title}</td>
                        <td className="px-4 py-3 mono font-semibold" style={{ color: 'var(--text)' }}>{fmtCurrency(Number(r.requestedAmount), r.currency)}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-3)' }}>{fmtDate(r.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: b.bg, color: b.color }}>{b.label}</span>
                        </td>
                        <td className="px-4 py-3 mono text-[10px]" style={{ color: 'var(--text-3)' }}>
                          {(r._count?.creditRequests ?? 0)} cr · {(r._count?.transactions ?? 0)} txn
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {r.status === 'DRAFT' && (
                              <button onClick={() => act('submit', r.id)} disabled={action.isPending}
                                className="px-2 py-1 rounded text-[10px] font-semibold hover:opacity-80" style={{ background: 'rgba(59,130,246,0.14)', color: '#3B82F6' }}>Submit</button>
                            )}
                            {r.status === 'SUBMITTED' && canReview && (
                              <>
                                <button onClick={() => act('approve', r.id)} disabled={action.isPending}
                                  className="px-2 py-1 rounded text-[10px] font-semibold hover:opacity-80" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>Approve</button>
                                <button onClick={() => act('reject', r.id)} disabled={action.isPending}
                                  className="px-2 py-1 rounded text-[10px] font-semibold hover:opacity-80" style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>Reject</button>
                              </>
                            )}
                            {(r.status === 'DRAFT' || r.status === 'SUBMITTED') && (
                              <button onClick={() => act('cancel', r.id)} disabled={action.isPending}
                                className="px-2 py-1 rounded text-[10px] font-semibold hover:opacity-80" style={{ background: 'var(--bg-3)', color: 'var(--text-3)' }}>Cancel</button>
                            )}
                            {r.status === 'APPROVED' && (
                              <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>→ assess credit</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-xs" style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text-3)' }}>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, meta.total)} of {meta.total}</span>
              <div className="flex items-center gap-1">
                <GhostButton onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</GhostButton>
                <GhostButton onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}>Next →</GhostButton>
              </div>
            </div>
          )}
        </div>
      </div>
      <NewSalesRequestModal open={newOpen} onClose={() => setNewOpen(false)} />
    </>
  );
}
