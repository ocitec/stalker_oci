'use client';

import { useState } from 'react';
import { Search, Plus, ShieldCheck } from 'lucide-react';
import { useCreditRequests, useCreditAction } from '@/lib/hooks/useControlChain';
import { useAuthStore } from '@/lib/store/auth.store';
import { SkeletonTable, GhostButton, AmberButton, EmptyState } from '@/components/ui';
import { fmtCurrency, fmtDate, getRiskBadgeClass, getPdiLabel } from '@/lib/utils';
import { chainBadge } from '@/lib/utils/chain';
import { NewCreditRequestModal } from '@/components/forms/NewCreditRequestModal';

const STATUS_OPTIONS = ['', 'PENDING', 'APPROVED', 'DECLINED', 'ON_HOLD', 'EXPIRED'];
const PAGE_SIZE = 20;

export default function CreditPage() {
  const role = useAuthStore(s => s.user?.role);
  const canDecide = role === 'ADMIN' || role === 'CFO';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page,   setPage]   = useState(1);
  const [newOpen, setNewOpen] = useState(false);

  const { data, isLoading } = useCreditRequests({
    search: search || undefined, status: status || undefined, page, limit: PAGE_SIZE,
  });
  const action = useCreditAction();
  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none w-56"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              placeholder="Search reference, client…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="px-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
          </select>
          <div className="flex-1" />
          <AmberButton onClick={() => setNewOpen(true)}>
            <Plus size={12} className="inline mr-1" />New Credit Request
          </AmberButton>
        </div>

        <div className="card overflow-hidden">
          {isLoading ? <SkeletonTable rows={8} /> : rows.length === 0 ? (
            <EmptyState icon={<ShieldCheck size={32} />} title="No credit requests" sub="Open an assessment for an approved sales request" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 760 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Reference', 'Client', 'Sales Ref', 'Requested', 'Approved', 'Risk', 'Status', 'Actions'].map(h => (
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
                        <td className="px-4 py-3 mono text-[10px]" style={{ color: 'var(--text-3)' }}>{r.salesRequest?.reference ?? '—'}</td>
                        <td className="px-4 py-3 mono font-semibold" style={{ color: 'var(--text)' }}>{fmtCurrency(Number(r.requestedAmount), r.currency)}</td>
                        <td className="px-4 py-3 mono" style={{ color: r.approvedAmount ? 'var(--green)' : 'var(--text-3)' }}>
                          {r.approvedAmount ? fmtCurrency(Number(r.approvedAmount), r.currency) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {r.client?.riskStatus
                            ? <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${getRiskBadgeClass(r.client.riskStatus)}`}>{getPdiLabel(Number(r.client.paymentDisciplineIndex ?? 100))}</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: b.bg, color: b.color }}>{b.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {canDecide && (r.status === 'PENDING' || r.status === 'ON_HOLD') && (
                              <button onClick={() => action.mutate({ action: 'approve', id: r.id })} disabled={action.isPending}
                                className="px-2 py-1 rounded text-[10px] font-semibold hover:opacity-80" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>Approve</button>
                            )}
                            {canDecide && (r.status === 'PENDING' || r.status === 'ON_HOLD') && (
                              <button onClick={() => action.mutate({ action: 'decline', id: r.id })} disabled={action.isPending}
                                className="px-2 py-1 rounded text-[10px] font-semibold hover:opacity-80" style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>Decline</button>
                            )}
                            {canDecide && r.status === 'PENDING' && (
                              <button onClick={() => action.mutate({ action: 'hold', id: r.id })} disabled={action.isPending}
                                className="px-2 py-1 rounded text-[10px] font-semibold hover:opacity-80" style={{ background: 'rgba(245,158,11,0.14)', color: '#F59E0B' }}>Hold</button>
                            )}
                            {r.status === 'APPROVED' && (
                              <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{(r._count?.transactions ?? 0)} txn · → create transaction</span>
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
      <NewCreditRequestModal open={newOpen} onClose={() => setNewOpen(false)} />
    </>
  );
}
