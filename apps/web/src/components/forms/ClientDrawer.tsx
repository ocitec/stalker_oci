'use client';

import { useState } from 'react';
import {
  X, Building2, Shield, ShieldOff, ShieldCheck, FileText,
  AlertTriangle, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { useClient, useInvoices, useBlockClient, useUnblockClient } from '@/lib/hooks/useApi';
import { Badge, AmberButton, GhostButton, PdiBar, SkeletonCard } from '@/components/ui';
import { fmtCurrency, fmtDate, getStatusClass, getStatusLabel, getPdiColor, getPdiLabel, getRiskBadgeClass } from '@/lib/utils';
import { ActionSeverity } from '@/types';

interface Props {
  clientId: string | null;
  onClose: () => void;
  onViewInvoice?: (id: string) => void;
}

function getActionColor(severity: ActionSeverity): string {
  switch (severity) {
    case 'CRITICAL': return '#F43F5E';
    case 'HIGH':     return '#F97316';
    case 'MEDIUM':   return '#F59E0B';
    default:         return '#3B82F6';
  }
}

function getActionBg(severity: ActionSeverity): string {
  switch (severity) {
    case 'CRITICAL': return 'rgba(244,63,94,0.08)';
    case 'HIGH':     return 'rgba(249,115,22,0.08)';
    case 'MEDIUM':   return 'rgba(245,158,11,0.08)';
    default:         return 'rgba(59,130,246,0.08)';
  }
}

function getActionBorder(severity: ActionSeverity): string {
  switch (severity) {
    case 'CRITICAL': return 'rgba(244,63,94,0.25)';
    case 'HIGH':     return 'rgba(249,115,22,0.25)';
    case 'MEDIUM':   return 'rgba(245,158,11,0.25)';
    default:         return 'rgba(59,130,246,0.25)';
  }
}

export function ClientDrawer({ clientId, onClose, onViewInvoice }: Props) {
  const { data: client, isLoading } = useClient(clientId ?? '');
  const { data: invoicesData }      = useInvoices({ clientId: clientId ?? '', limit: 20 });
  const blockClient   = useBlockClient();
  const unblockClient = useUnblockClient();

  const [blockReason, setBlockReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);

  const invoices = invoicesData?.data ?? [];
  const pdi      = Math.round(Number(client?.paymentDisciplineIndex ?? 0));
  const utilPct  = client?.utilizationPercent ?? 0;
  const utilColor = utilPct > 80 ? '#F43F5E' : utilPct > 50 ? '#F59E0B' : '#10B981';

  const rec   = client?.riskExplanation?.recommendedAction;
  const rxp   = client?.riskExplanation;

  if (!clientId) return null;

  async function handleBlock() {
    if (!clientId || !blockReason.trim()) return;
    await blockClient.mutateAsync({ id: clientId, reason: blockReason });
    setShowBlockForm(false);
    setBlockReason('');
  }

  async function handleUnblock() {
    if (!clientId) return;
    await unblockClient.mutateAsync({ id: clientId });
  }

  return (
    <div className="drawer-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="animate-slide-right h-full flex flex-col"
        style={{ width: 480, background: 'var(--bg-1)', borderLeft: '1px solid var(--border)', overflowY: 'auto' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Building2 size={15} style={{ color: 'var(--amber)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {client?.name ?? 'Client Detail'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70 transition-all"
            style={{ background: 'var(--bg-3)' }}
          >
            <X size={14} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : !client ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Client not found</p>
          </div>
        ) : (
          <div className="flex-1 p-5 space-y-5">

            {/* Blocked banner */}
            {client.isBlocked && (
              <div
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)' }}
              >
                <ShieldOff size={16} style={{ color: '#F43F5E', flexShrink: 0 }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#F43F5E' }}>Client is BLOCKED</p>
                  {client.blockedReason && (
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>Reason: {client.blockedReason}</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Recommended Action panel ─────────────────────────────── */}
            {rec && (
              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                  Recommended Action
                </p>
                <div
                  className="p-3.5 rounded-lg"
                  style={{ background: getActionBg(rec.severity), border: `1px solid ${getActionBorder(rec.severity)}` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={13} style={{ color: getActionColor(rec.severity), flexShrink: 0 }} />
                    <p className="text-sm font-bold" style={{ color: getActionColor(rec.severity) }}>
                      {rec.action}
                    </p>
                    <Badge
                      style={{
                        marginLeft: 'auto',
                        background: getActionBg(rec.severity),
                        color: getActionColor(rec.severity),
                        borderColor: getActionBorder(rec.severity),
                        fontSize: 9,
                      }}
                    >
                      {rec.severity}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {rec.reasons.map((r: string, i: number) => (
                      <p key={i} className="text-[11px] flex items-start gap-1.5" style={{ color: 'var(--text-2)' }}>
                        <span style={{ color: getActionColor(rec.severity), flexShrink: 0 }}>•</span>
                        {r}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Profile */}
            <div>
              <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Profile</p>
              <div style={{ background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                {[
                  { label: 'Company',        value: client.name },
                  { label: 'Email',          value: client.email      ?? '—' },
                  { label: 'Phone',          value: client.phone      ?? '—' },
                  { label: 'Sector',         value: client.sector     ?? '—' },
                  { label: 'Reg. Number',    value: client.companyRegistration ?? '—' },
                  { label: 'SLA Days',       value: `${client.slaDays} days` },
                  { label: 'Member Since',   value: fmtDate(client.createdAt) },
                ].map((row, i, arr) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-2.5 text-xs"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <span style={{ color: 'var(--text-3)' }}>{row.label}</span>
                    <span className="font-medium text-right ml-4" style={{ color: 'var(--text)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PDI + risk */}
            <div>
              <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Payment Health</p>
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="p-3 rounded-lg text-center"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
                >
                  <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-3)' }}>PDI Score</p>
                  <p className="mono text-3xl font-black" style={{ color: getPdiColor(pdi) }}>{pdi}</p>
                  <p className="text-[10px] mt-1" style={{ color: getPdiColor(pdi) }}>{getPdiLabel(pdi)}</p>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
                >
                  <p className="text-[10px] mb-2" style={{ color: 'var(--text-3)' }}>Credit Utilisation</p>
                  <div className="h-2 rounded-full mb-1.5" style={{ background: 'var(--bg-3)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, utilPct)}%`, background: utilColor }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="mono font-bold" style={{ color: utilColor }}>{utilPct}%</span>
                    <span style={{ color: 'var(--text-3)' }}>{fmtCurrency(Number(client.creditLimit))}</span>
                  </div>
                  {client.outstandingAmount != null && (
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>
                      Outstanding: <span className="mono font-semibold" style={{ color: 'var(--text-2)' }}>
                        {fmtCurrency(client.outstandingAmount)}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Why This Risk? ───────────────────────────────────────── */}
            {rxp && (
              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                  Why This Risk?
                </p>
                <div style={{ background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  {[
                    {
                      label: 'PDI Score',
                      value: String(pdi),
                      color: getPdiColor(pdi),
                    },
                    {
                      label: 'Average Delay Days',
                      value: rxp.avgDelayDays > 0 ? `${rxp.avgDelayDays}d` : 'None',
                      color: rxp.avgDelayDays > 30 ? '#F43F5E' : rxp.avgDelayDays > 10 ? '#F59E0B' : 'var(--green)',
                    },
                    {
                      label: 'SLA Breaches (Total)',
                      value: String(rxp.slaBreachCount),
                      color: rxp.slaBreachCount > 3 ? '#F43F5E' : rxp.slaBreachCount > 1 ? '#F59E0B' : 'var(--text)',
                    },
                    {
                      label: 'SLA Breaches (Active)',
                      value: String(rxp.unresolvedSlaCount),
                      color: rxp.unresolvedSlaCount > 0 ? '#F43F5E' : 'var(--green)',
                    },
                    {
                      label: 'Risk Trend',
                      value: rxp.riskTrend,
                      color: rxp.riskTrend === 'IMPROVING' ? 'var(--green)' : rxp.riskTrend === 'DETERIORATING' ? '#F43F5E' : 'var(--text-2)',
                      icon: rxp.riskTrend === 'IMPROVING'
                        ? <TrendingUp size={11} style={{ color: 'var(--green)' }} />
                        : rxp.riskTrend === 'DETERIORATING'
                        ? <TrendingDown size={11} style={{ color: '#F43F5E' }} />
                        : <Minus size={11} style={{ color: 'var(--text-3)' }} />,
                    },
                  ].map((row, i, arr) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-2.5 text-xs"
                      style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <span style={{ color: 'var(--text-3)' }}>{row.label}</span>
                      <span className="mono font-bold flex items-center gap-1.5" style={{ color: row.color }}>
                        {(row as any).icon}
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invoices */}
            <div>
              <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                Recent Invoices
                {invoices.length > 0 && (
                  <span className="mono normal-case font-normal ml-1.5" style={{ color: 'var(--text-3)' }}>
                    ({invoices.length})
                  </span>
                )}
              </p>
              {invoices.length === 0 ? (
                <div
                  className="p-4 rounded-lg text-center text-xs"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
                >
                  No invoices yet
                </div>
              ) : (
                <div className="space-y-1.5">
                  {invoices.map((inv: any) => (
                    <button
                      key={inv.id}
                      onClick={() => onViewInvoice?.(inv.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-left hover:opacity-80 transition-all"
                      style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
                    >
                      <FileText size={12} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                      <span className="flex-1 font-medium truncate" style={{ color: 'var(--text)' }}>{inv.invoiceNumber}</span>
                      <span className="mono" style={{ color: 'var(--text-2)' }}>{fmtCurrency(Number(inv.invoiceAmount))}</span>
                      <Badge className={getStatusClass(inv.status)}>{getStatusLabel(inv.status)}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            {client.notes && (
              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Notes</p>
                <div
                  className="p-3 rounded-lg text-xs leading-relaxed"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                >
                  {client.notes}
                </div>
              </div>
            )}

            {/* Block form */}
            {showBlockForm && (
              <div
                className="p-4 rounded-lg space-y-3"
                style={{ background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.25)' }}
              >
                <p className="text-xs font-semibold" style={{ color: '#F43F5E' }}>
                  Block client — enter reason
                </p>
                <textarea
                  className="form-input resize-none text-xs"
                  rows={2}
                  placeholder="Reason for blocking (e.g. repeated non-payment, credit limit breach)…"
                  value={blockReason}
                  onChange={e => setBlockReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleBlock}
                    disabled={!blockReason.trim() || blockClient.isPending}
                    className="px-4 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                    style={{ background: '#F43F5E', color: '#fff' }}
                  >
                    {blockClient.isPending ? 'Blocking…' : 'Confirm Block'}
                  </button>
                  <GhostButton onClick={() => { setShowBlockForm(false); setBlockReason(''); }}>
                    Cancel
                  </GhostButton>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {client && (
          <div
            className="sticky bottom-0 px-5 py-4 flex gap-3"
            style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}
          >
            {client.isBlocked ? (
              <button
                onClick={handleUnblock}
                disabled={unblockClient.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40 flex-1 justify-center"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }}
              >
                <ShieldCheck size={13} />
                {unblockClient.isPending ? 'Unblocking…' : 'Unblock Client'}
              </button>
            ) : (
              !showBlockForm && (
                <button
                  onClick={() => setShowBlockForm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-80 flex-1 justify-center"
                  style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.2)' }}
                >
                  <ShieldOff size={13} />
                  Block Client
                </button>
              )
            )}
            <GhostButton onClick={onClose}>Close</GhostButton>
          </div>
        )}
      </div>
    </div>
  );
}
