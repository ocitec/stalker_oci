'use client';

import { useState, useEffect } from 'react';
import { X, ArrowLeftRight, CheckCircle2, Clock } from 'lucide-react';
import { useTransaction, useTransactionAction } from '@/lib/hooks/useControlChain';
import { useAuthStore } from '@/lib/store/auth.store';
import { fmtCurrency, fmtDate, fmtDateTime } from '@/lib/utils';
import { chainBadge, prettyStatus } from '@/lib/utils/chain';

interface Props { transactionId: string | null; onClose: () => void; }

const PAYMENT_STATUSES = ['PENDING', 'VERIFIED', 'FAILED', 'PARTIALLY_PAID'];
const FULFILMENT_STATUSES = ['PENDING', 'PROCESSING', 'FULFILLED', 'PARTIALLY_FULFILLED', 'FAILED'];

function Row({ label, children, accent }: { label: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="mono text-xs font-semibold" style={{ color: accent || 'var(--text)' }}>{children}</span>
    </div>
  );
}

export function TransactionDrawer({ transactionId, onClose }: Props) {
  const role = useAuthStore(s => s.user?.role);
  const canReview = role === 'ADMIN' || role === 'CFO' || role === 'FINANCE';
  const { data: t, isLoading } = useTransaction(transactionId);
  const action = useTransactionAction();

  const [pay, setPay] = useState('PENDING');
  const [ful, setFul] = useState('PENDING');

  useEffect(() => {
    if (t) { setPay(t.clientPaymentStatus ?? 'PENDING'); setFul(t.fulfilmentStatus ?? 'PENDING'); }
  }, [t]);

  if (!transactionId) return null;
  const cur = t?.currency ?? 'NGN';
  const badge = chainBadge(t?.status);
  const run = (a: string, payload?: any) => action.mutate({ action: a, id: transactionId, payload });

  return (
    <div className="drawer-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="animate-slide-right h-full overflow-y-auto"
        style={{ width: 480, maxWidth: '100%', background: 'var(--bg-1)', borderLeft: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 sticky top-0"
          style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <ArrowLeftRight size={15} style={{ color: 'var(--indigo-2)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold mono" style={{ color: 'var(--text)' }}>{t?.reference ?? '…'}</h2>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>SRF {t?.srfNumber ?? '—'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70" style={{ background: 'var(--bg-3)' }}>
            <X size={14} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {isLoading || !t ? (
          <div className="p-6 text-xs" style={{ color: 'var(--text-3)' }}>Loading…</div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Status + client */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{t.client?.name}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{fmtDate(t.transactionDate)} · {t.clientCode ?? 'no code'}</p>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
            </div>

            {/* Financials */}
            <div className="card p-3">
              <p className="text-[10px] uppercase tracking-widest mb-1 font-medium" style={{ color: 'var(--text-3)' }}>Financials</p>
              <Row label="Transaction Value">{fmtCurrency(t.newTransactionValue, cur)}</Row>
              <Row label="Supplier Cost">{fmtCurrency(t.supplierCost, cur)}</Row>
              <Row label="Gross Margin" accent={t.grossMargin >= 0 ? 'var(--green)' : 'var(--red)'}>{fmtCurrency(t.grossMargin, cur)}</Row>
              <Row label="Profit %" accent={t.profitPercentage >= 0 ? 'var(--green)' : 'var(--red)'}>{Number(t.profitPercentage).toFixed(1)}%</Row>
            </div>

            {/* Exposure */}
            <div className="card p-3">
              <p className="text-[10px] uppercase tracking-widest mb-1 font-medium" style={{ color: 'var(--text-3)' }}>Exposure</p>
              <Row label="Credit Limit">{fmtCurrency(t.creditLimit, cur)}</Row>
              <Row label="Current Exposure">{fmtCurrency(t.currentExposure, cur)}</Row>
              <Row label="Post-Transaction" accent={t.exceedsLimit ? 'var(--red)' : 'var(--text)'}>{fmtCurrency(t.postTransactionExposure, cur)}</Row>
              <Row label="Available Credit">{fmtCurrency(t.availableCredit, cur)}</Row>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ background: t.clientEligible ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)', color: t.clientEligible ? '#10B981' : '#F43F5E' }}>
                  {t.clientEligible ? 'Eligible' : 'Not eligible'}
                </span>
                {t.exceedsLimit && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>Exceeds limit</span>
                )}
              </div>
            </div>

            {/* Approval */}
            <div className="card p-3">
              <p className="text-[10px] uppercase tracking-widest mb-1 font-medium" style={{ color: 'var(--text-3)' }}>Approval Workflow</p>
              <Row label="Level Progress">{t.approvalLevel} / {t.requiredApprovalLevel}</Row>
              <Row label="Next Approver">{t.currentApproverRole ? prettyStatus(t.currentApproverRole) : '—'}</Row>
              {t.approvals?.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {t.approvals.map((a: any) => {
                    const ab = chainBadge(a.decision);
                    return (
                      <div key={a.id} className="flex items-center justify-between text-[10px]">
                        <span style={{ color: 'var(--text-3)' }}>L{a.level} · {a.approver?.name ?? 'System'} ({a.approverRole})</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: ab.bg, color: ab.color }}>{ab.label}</span>
                          <span style={{ color: 'var(--text-3)' }}>{fmtDateTime(a.createdAt)}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment verification */}
            <div className="card p-3">
              <p className="text-[10px] uppercase tracking-widest mb-2 font-medium" style={{ color: 'var(--text-3)' }}>Payment Verification</p>
              <div className="flex items-center gap-2">
                <select className="form-input flex-1" value={pay} onChange={e => setPay(e.target.value)}>
                  {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{prettyStatus(s)}</option>)}
                </select>
                <button onClick={() => run('verifyPayment', { clientPaymentStatus: pay })} disabled={action.isPending}
                  className="px-3 py-2 rounded-lg text-[11px] font-semibold hover:opacity-80" style={{ background: 'rgba(99,102,241,0.14)', color: 'var(--indigo-2)' }}>
                  <CheckCircle2 size={12} className="inline mr-1" />Save
                </button>
              </div>
              {t.paymentSource && <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-3)' }}>Source: {t.paymentSource}</p>}
            </div>

            {/* Fulfilment (approved only) */}
            {t.status === 'APPROVED' && (
              <div className="card p-3">
                <p className="text-[10px] uppercase tracking-widest mb-2 font-medium" style={{ color: 'var(--text-3)' }}>Service Fulfilment</p>
                <div className="flex items-center gap-2">
                  <select className="form-input flex-1" value={ful} onChange={e => setFul(e.target.value)}>
                    {FULFILMENT_STATUSES.map(s => <option key={s} value={s}>{prettyStatus(s)}</option>)}
                  </select>
                  <button onClick={() => run('fulfilment', { fulfilmentStatus: ful })} disabled={action.isPending}
                    className="px-3 py-2 rounded-lg text-[11px] font-semibold hover:opacity-80" style={{ background: 'rgba(99,102,241,0.14)', color: 'var(--indigo-2)' }}>
                    <Clock size={12} className="inline mr-1" />Save
                  </button>
                </div>
              </div>
            )}

            {/* Workflow actions */}
            {canReview && (
              <div className="flex flex-wrap gap-2 pt-1">
                {t.status === 'DRAFT' && (
                  <button onClick={() => run('submit')} disabled={action.isPending}
                    className="px-3 py-2 rounded-lg text-[11px] font-semibold hover:opacity-80" style={{ background: 'rgba(59,130,246,0.14)', color: '#3B82F6' }}>Submit for Review</button>
                )}
                {t.status === 'PENDING_REVIEW' && (
                  <>
                    <button onClick={() => run('approve')} disabled={action.isPending}
                      className="px-3 py-2 rounded-lg text-[11px] font-semibold hover:opacity-80" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>Approve L{t.approvalLevel + 1}</button>
                    <button onClick={() => run('decline')} disabled={action.isPending}
                      className="px-3 py-2 rounded-lg text-[11px] font-semibold hover:opacity-80" style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>Decline</button>
                    <button onClick={() => run('hold')} disabled={action.isPending}
                      className="px-3 py-2 rounded-lg text-[11px] font-semibold hover:opacity-80" style={{ background: 'rgba(245,158,11,0.14)', color: '#F59E0B' }}>Hold</button>
                  </>
                )}
                {t.status === 'ON_HOLD' && (
                  <button onClick={() => run('resume')} disabled={action.isPending}
                    className="px-3 py-2 rounded-lg text-[11px] font-semibold hover:opacity-80" style={{ background: 'rgba(59,130,246,0.14)', color: '#3B82F6' }}>Resume Review</button>
                )}
                {['DRAFT', 'PENDING_REVIEW', 'ON_HOLD'].includes(t.status) && (
                  <button onClick={() => run('cancel')} disabled={action.isPending}
                    className="px-3 py-2 rounded-lg text-[11px] font-semibold hover:opacity-80" style={{ background: 'var(--bg-3)', color: 'var(--text-3)' }}>Cancel</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
