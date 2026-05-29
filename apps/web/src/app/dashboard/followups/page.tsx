'use client';

import { useState } from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { useFollowUpCompliance, useOverdueInvoices, useCreateFollowUp } from '@/lib/hooks/useApi';
import { SectionTitle, Badge, SkeletonCard, GhostButton, AmberButton, EmptyState } from '@/components/ui';
import { fmtCurrency, getFollowUpColor } from '@/lib/utils';
import { FollowUpType } from '@/types';

interface ClientInfo {
  name: string;
}

interface FollowUpInvoice {
  id: string;
  dueDate: string;
  client?: ClientInfo;
  invoiceNumber: string;
  invoiceAmount: number | string;
  daysOverdue: number;
  daysSinceFollowUp?: number;
}

interface FollowUpCompliance {
  overdueTotal?: number;
  overdueInvoices?: number;
  withRecentFollowUp?: number;
  recentFollowUps?: number;
  staleCount?: number;
  complianceRate?: number;
  staleInvoices?: FollowUpInvoice[];
}

const FU_TYPES: FollowUpType[] = ['EMAIL', 'PHONE', 'WHATSAPP', 'IN_PERSON', 'ESCALATION', 'LETTER'];

function daysSince(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

export default function FollowUpsPage() {
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [fuType,          setFuType]          = useState<FollowUpType>('EMAIL');
  const [notes,           setNotes]           = useState<string>('');
  const [showForm,        setShowForm]        = useState<boolean>(false);

  const { data: compliance, isLoading: compLoading } = useFollowUpCompliance();
  const { data: overdue }   = useOverdueInvoices();
  const createFollowUp      = useCreateFollowUp();

  // ── API key normalisation ─────────────────────────────────────────────────
  // The compliance endpoint returns { overdueInvoices, recentFollowUps, staleCount,
  // complianceRate, staleInvoices }. Some field names differ from what the UI uses.
  const overdueTotal: number       = compliance?.overdueTotal       ?? compliance?.overdueInvoices   ?? 0;
  const withRecentFollowUp: number = compliance?.withRecentFollowUp ?? compliance?.recentFollowUps   ?? 0;
  const staleCount: number         = compliance?.staleCount         ?? 0;
  const complianceRate: number     = compliance?.complianceRate     ?? 0;
  const staleInvoices: FollowUpInvoice[] = compliance?.staleInvoices ?? [];

  async function handleLog(): Promise<void> {
    if (!selectedInvoice) return;
    await createFollowUp.mutateAsync({
      invoiceId:    selectedInvoice,
      followUpType: fuType,
      notes:        notes || undefined,
    });
    setShowForm(false);
    setNotes('');
    setSelectedInvoice(null);
  }

  return (
    <div className="grid grid-cols-2 gap-5 animate-fade-in">

      {/* ── Left: Follow-up Clock ───────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="card p-5">
          <SectionTitle
            title="Follow-up Clock"
            badge={
              staleCount > 0 ? (
                <Badge style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>
                  {staleCount} stale
                </Badge>
              ) : undefined
            }
          />

          {(overdue?.length ?? 0) === 0 ? (
            <EmptyState icon={<CheckCircle2 size={28} />} title="No overdue invoices" sub="All caught up!" />
          ) : (
            <div className="space-y-2">
              {(overdue ?? [])
                .sort((a: FollowUpInvoice, b: FollowUpInvoice) => (b.daysSinceFollowUp ?? 0) - (a.daysSinceFollowUp ?? 0))
                .map((inv: FollowUpInvoice) => {
                  const days  = inv.daysSinceFollowUp ?? daysSince(inv.dueDate);
                  const color = getFollowUpColor(days);
                  return (
                    <div
                      key={inv.id}
                      onClick={() => { setSelectedInvoice(inv.id); setShowForm(true); }}
                      className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:opacity-80"
                      style={{
                        background: 'var(--bg-2)',
                        border: `1px solid ${selectedInvoice === inv.id ? 'var(--amber)' : 'var(--border)'}`,
                      }}
                    >
                      <div className="mono text-xl font-black w-10 text-right flex-shrink-0" style={{ color }}>
                        {days}d
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                          {inv.client?.name}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-3)' }}>
                          {inv.invoiceNumber} · {inv.daysOverdue}d overdue
                        </p>
                      </div>
                      <div className="mono text-xs font-bold flex-shrink-0" style={{ color: 'var(--text)' }}>
                        {fmtCurrency(Number(inv.invoiceAmount))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* SLA Metrics */}
        <div className="card p-5">
          <SectionTitle title="Follow-up SLA Metrics" />
          {compLoading ? <SkeletonCard /> : (
            <div className="space-y-0">
              {[
                { label: 'Overdue invoices',            value: overdueTotal,       color: 'var(--red)' },
                { label: 'With recent follow-up (≤5d)', value: withRecentFollowUp, color: 'var(--green)' },
                { label: 'Stale (>5d no contact)',      value: staleCount,         color: 'var(--amber)' },
                { label: 'Compliance rate',             value: `${complianceRate}%`, color: 'var(--text)' },
              ].map(m => (
                <div
                  key={m.label}
                  className="flex items-center justify-between py-2.5 border-b text-xs"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span style={{ color: 'var(--text-2)' }}>{m.label}</span>
                  <span className="mono font-bold" style={{ color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Log Form + Stale Alerts ─────────────────────────────── */}
      <div className="space-y-4">

        {/* Log form — shown when invoice selected */}
        {showForm && selectedInvoice ? (
          <div
            className="card p-5"
            style={{ borderColor: 'var(--amber)', borderWidth: 1 }}
          >
            <SectionTitle title="Log Follow-up" />
            <div className="space-y-3">

              {/* Contact method */}
              <div>
                <label className="form-label">Contact Method</label>
                <div className="flex flex-wrap gap-2">
                  {FU_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => setFuType(t)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: fuType === t ? 'var(--amber)' : 'var(--bg-3)',
                        color:      fuType === t ? '#000'          : 'var(--text-2)',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input resize-none"
                  rows={3}
                  placeholder="What was discussed? Any commitment made?"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <AmberButton onClick={handleLog} disabled={createFollowUp.isPending}>
                  {createFollowUp.isPending ? 'Logging…' : 'Log Follow-up'}
                </AmberButton>
                <GhostButton onClick={() => { setShowForm(false); setSelectedInvoice(null); }}>
                  Cancel
                </GhostButton>
              </div>
            </div>
          </div>
        ) : (
          /* Placeholder when no invoice selected */
          <div className="card p-5 flex flex-col items-center justify-center gap-3 py-12">
            <Clock size={36} style={{ color: 'var(--text-3)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
              Select an invoice to log a follow-up
            </p>
            <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
              Click any overdue invoice on the left
            </p>
          </div>
        )}

        {/* Stale Alerts */}
        <div className="card p-5">
          <SectionTitle title="Stale Follow-up Alerts" />
          <div className="space-y-2">
            {staleInvoices.slice(0, 6).map((inv: FollowUpInvoice) => (
              <div
                key={inv.id}
                className="p-3 rounded-lg border-l-2"
                style={{ background: 'var(--bg-2)', borderLeftColor: '#F43F5E' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                      {inv.client?.name} — {inv.invoiceNumber}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                      No follow-up in{' '}
                      <span style={{ color: '#F43F5E', fontWeight: 700 }}>
                        {inv.daysSinceFollowUp ?? daysSince(inv.dueDate)}d
                      </span>.{' '}
                      {fmtCurrency(Number(inv.invoiceAmount))} · {inv.daysOverdue}d overdue
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedInvoice(inv.id); setShowForm(true); }}
                    className="text-[10px] px-2 py-1 rounded flex-shrink-0 font-semibold hover:opacity-80 transition-all"
                    style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--amber)' }}
                  >
                    Log
                  </button>
                </div>
              </div>
            ))}
            {staleInvoices.length === 0 && (
              <EmptyState icon={<CheckCircle2 size={24} />} title="All follow-ups on track" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
