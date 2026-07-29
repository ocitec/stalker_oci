'use client';

import { useState } from 'react';
import { Search, Plus, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import {
  useTransactions, useTransactionDashboard,
} from '@/lib/hooks/useControlChain';
import { KpiCard, SkeletonTable, GhostButton, AmberButton, EmptyState } from '@/components/ui';
import { fmtCurrency, fmtDate } from '@/lib/utils';
import { chainBadge, prettyStatus } from '@/lib/utils/chain';
import { NewTransactionModal } from '@/components/forms/NewTransactionModal';
import { TransactionDrawer } from '@/components/forms/TransactionDrawer';

const STATUS_OPTIONS = ['', 'DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ON_HOLD', 'DECLINED', 'CANCELLED'];
const FULFILMENT_OPTIONS = ['', 'PENDING', 'PROCESSING', 'FULFILLED', 'PARTIALLY_FULFILLED', 'FAILED'];
const PAGE_SIZE = 20;

export default function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [fulfilment, setFulfilment] = useState('');
  const [page,   setPage]   = useState(1);
  const [newOpen, setNewOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const { data: dash, isLoading: dashLoading } = useTransactionDashboard();
  const { data, isLoading } = useTransactions({
    search: search || undefined, status: status || undefined,
    fulfilmentStatus: fulfilment || undefined, page, limit: PAGE_SIZE,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;
  const fulfilment_ = dash?.fulfilment ?? {};

  return (
    <>
      <div className="space-y-4 animate-fade-in">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard loading={dashLoading} label="Pending Approvals" value={dash?.pendingApprovals ?? 0}
            sub="Transactions awaiting review" accent={dash?.pendingApprovals ? 'var(--amber)' : undefined} />
          <KpiCard loading={dashLoading} label="Total Exposure" value={fmtCurrency(dash?.exposure?.totalExposure ?? 0)}
            sub="Active post-transaction exposure" />
          <KpiCard loading={dashLoading} label="Over Limit" value={dash?.exposure?.overLimitCount ?? 0}
            sub="Transactions exceeding limit" accent={dash?.exposure?.overLimitCount ? 'var(--red)' : undefined} />
          <KpiCard loading={dashLoading} label="Awaiting Verification" value={dash?.awaitingVerification ?? 0}
            sub="Client payment unverified" />
        </div>

        {/* Fulfilment progress + high-risk */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="card p-4 lg:col-span-1">
            <p className="text-[10px] uppercase tracking-widest mb-2 font-medium" style={{ color: 'var(--text-3)' }}>Fulfilment Progress</p>
            <div className="space-y-1.5">
              {['PENDING', 'PROCESSING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'FAILED'].map(s => {
                const b = chainBadge(s);
                return (
                  <div key={s} className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-2)' }}>{prettyStatus(s)}</span>
                    <span className="mono font-bold" style={{ color: b.color }}>{fulfilment_[s] ?? 0}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card p-4 lg:col-span-2">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={12} style={{ color: 'var(--amber)' }} />
              <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'var(--text-3)' }}>High-Risk / Over-Limit Transactions</p>
            </div>
            {(dash?.highRiskClients ?? []).length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: 'var(--text-3)' }}>None flagged</p>
            ) : (
              <div className="space-y-1">
                {dash.highRiskClients.slice(0, 5).map((r: any) => (
                  <div key={r.id} onClick={() => setDrawerId(r.id)}
                    className="flex items-center justify-between text-xs py-1.5 px-2 rounded cursor-pointer hover:opacity-80"
                    style={{ background: 'var(--bg-2)' }}>
                    <span style={{ color: 'var(--text)' }}>{r.client?.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="mono" style={{ color: 'var(--text-3)' }}>{fmtCurrency(r.postTransactionExposure, r.currency)}</span>
                      {r.exceedsLimit && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>OVER</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none w-56"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              placeholder="Search reference, SRF, client…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="px-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s ? prettyStatus(s) : 'All Status'}</option>)}
          </select>
          <select className="px-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            value={fulfilment} onChange={e => { setFulfilment(e.target.value); setPage(1); }}>
            {FULFILMENT_OPTIONS.map(s => <option key={s} value={s}>{s ? prettyStatus(s) : 'All Fulfilment'}</option>)}
          </select>
          <div className="flex-1" />
          <AmberButton onClick={() => setNewOpen(true)}>
            <Plus size={12} className="inline mr-1" />New Transaction
          </AmberButton>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {isLoading ? <SkeletonTable rows={8} /> : rows.length === 0 ? (
            <EmptyState icon={<ArrowLeftRight size={32} />} title="No transactions" sub="Create one from an approved credit request" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 820 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Reference', 'Client', 'Value', 'Margin', 'Post-Exposure', 'Approval', 'Status', 'Fulfilment'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium uppercase tracking-wide text-[10px]" style={{ color: 'var(--text-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => {
                    const b = chainBadge(r.status);
                    const fb = chainBadge(r.fulfilmentStatus);
                    return (
                      <tr key={r.id} onClick={() => setDrawerId(r.id)}
                        className="border-b cursor-pointer hover:opacity-90" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-4 py-3 mono text-[11px]" style={{ color: 'var(--text-3)' }}>{r.reference}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{r.client?.name ?? '—'}</td>
                        <td className="px-4 py-3 mono font-semibold" style={{ color: 'var(--text)' }}>{fmtCurrency(r.newTransactionValue, r.currency)}</td>
                        <td className="px-4 py-3 mono" style={{ color: r.grossMargin >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {fmtCurrency(r.grossMargin, r.currency)} <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{Number(r.profitPercentage).toFixed(0)}%</span>
                        </td>
                        <td className="px-4 py-3 mono" style={{ color: r.exceedsLimit ? 'var(--red)' : 'var(--text-2)' }}>{fmtCurrency(r.postTransactionExposure, r.currency)}</td>
                        <td className="px-4 py-3 mono text-[11px]" style={{ color: 'var(--text-3)' }}>{r.approvalLevel}/{r.requiredApprovalLevel}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: b.bg, color: b.color }}>{b.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: fb.bg, color: fb.color }}>{fb.label}</span>
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

      <NewTransactionModal open={newOpen} onClose={() => setNewOpen(false)} />
      <TransactionDrawer transactionId={drawerId} onClose={() => setDrawerId(null)} />
    </>
  );
}
