'use client';

import { X, CheckCircle, Clock, AlertTriangle, User, Calendar, FileText, DollarSign } from 'lucide-react';
import { useInvoice, useMarkPaid } from '@/lib/hooks/useApi';
import { Badge, AmberButton, GhostButton, SkeletonCard } from '@/components/ui';
import { fmtCurrency, fmtDate, getStatusClass, getStatusLabel, getPdiColor, getFollowUpColor } from '@/lib/utils';
import { FollowUpType } from '@/types';

const FU_ICON: Record<FollowUpType, string> = {
  EMAIL:      '✉',
  PHONE:      '📞',
  WHATSAPP:   '💬',
  IN_PERSON:  '🤝',
  ESCALATION: '🚨',
  LETTER:     '📄',
};

interface Props {
  invoiceId: string | null;
  onClose: () => void;
}

export function InvoiceDrawer({ invoiceId, onClose }: Props) {
  const { data: invoice, isLoading } = useInvoice(invoiceId ?? '');
  const markPaid = useMarkPaid();

  if (!invoiceId) return null;

  return (
    <div className="drawer-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="animate-slide-right h-full flex flex-col"
        style={{
          width: 460,
          background: 'var(--bg-1)',
          borderLeft: '1px solid var(--border)',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <FileText size={15} style={{ color: 'var(--amber)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {invoice?.invoiceNumber ?? 'Invoice Detail'}
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
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !invoice ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Invoice not found</p>
          </div>
        ) : (
          <div className="flex-1 p-5 space-y-5">

            {/* Status banner */}
            <div
              className="p-4 rounded-lg flex items-center justify-between"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
            >
              <div>
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-3)' }}>Status</p>
                <Badge className={getStatusClass(invoice.status)}>
                  {getStatusLabel(invoice.status)}
                  {invoice.daysOverdue ? ` — ${invoice.daysOverdue}d overdue` : ''}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Amount</p>
                <p className="mono text-xl font-bold" style={{ color: 'var(--text)' }}>
                  {fmtCurrency(Number(invoice.invoiceAmount))}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{invoice.currency}</p>
              </div>
            </div>

            {/* Invoice details grid */}
            <div>
              <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Invoice Details</p>
              <div style={{ background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                {[
                  { icon: <FileText size={12} />,    label: 'Invoice No.',   value: invoice.invoiceNumber },
                  { icon: <User size={12} />,         label: 'Client',        value: invoice.client?.name ?? '—' },
                  { icon: <Calendar size={12} />,     label: 'Issue Date',    value: fmtDate(invoice.invoiceDate) },
                  { icon: <Calendar size={12} />,     label: 'Due Date',      value: fmtDate(invoice.dueDate) },
                  invoice.paidDate
                    ? { icon: <CheckCircle size={12} />, label: 'Paid On',   value: fmtDate(invoice.paidDate) }
                    : null,
                  invoice.paidAmount
                    ? { icon: <DollarSign size={12} />, label: 'Paid Amount', value: fmtCurrency(Number(invoice.paidAmount)) }
                    : null,
                ].filter(Boolean).map((row, i, arr) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-2.5 text-xs"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <span className="flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
                      {row!.icon}{row!.label}
                    </span>
                    <span className="font-medium" style={{ color: 'var(--text)' }}>{row!.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Client PDI */}
            {invoice.client && (
              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Client Metrics</p>
                <div
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-2)' }}>Payment Discipline Index</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 rounded-full" style={{ background: 'var(--bg-3)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Number(invoice.client.paymentDisciplineIndex)}%`,
                          background: getPdiColor(Number(invoice.client.paymentDisciplineIndex)),
                        }}
                      />
                    </div>
                    <span
                      className="mono text-sm font-bold"
                      style={{ color: getPdiColor(Number(invoice.client.paymentDisciplineIndex)) }}
                    >
                      {Math.round(Number(invoice.client.paymentDisciplineIndex))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Notes</p>
                <div
                  className="p-3 rounded-lg text-xs leading-relaxed"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                >
                  {invoice.notes}
                </div>
              </div>
            )}

            {/* Follow-up timeline */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                  Follow-up History
                </p>
                {invoice.daysSinceFollowUp != null && (
                  <span
                    className="mono text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{
                      background: `${getFollowUpColor(invoice.daysSinceFollowUp)}22`,
                      color: getFollowUpColor(invoice.daysSinceFollowUp),
                    }}
                  >
                    {invoice.daysSinceFollowUp}d since last contact
                  </span>
                )}
              </div>

              {!invoice.followUps || invoice.followUps.length === 0 ? (
                <div
                  className="p-4 rounded-lg text-center text-xs"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
                >
                  <Clock size={20} className="mx-auto mb-2" style={{ color: 'var(--text-3)' }} />
                  No follow-ups logged yet
                </div>
              ) : (
                <div className="space-y-2">
                  {invoice.followUps.map((fu: { id: string; followUpType: FollowUpType; followUpDate: string; user?: { name: string }; notes?: string }, i: number) => (
                    <div
                      key={fu.id}
                      className="flex gap-3 p-3 rounded-lg text-xs"
                      style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                        style={{ background: 'var(--bg-3)' }}
                      >
                        {FU_ICON[fu.followUpType as FollowUpType] ?? '📋'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-semibold" style={{ color: 'var(--text)' }}>{fu.followUpType}</span>
                          <span style={{ color: 'var(--text-3)' }}>{fmtDate(fu.followUpDate)}</span>
                        </div>
                        {fu.user && (
                          <p style={{ color: 'var(--text-3)' }}>by {fu.user.name}</p>
                        )}
                        {fu.notes && (
                          <p className="mt-1 leading-relaxed" style={{ color: 'var(--text-2)' }}>{fu.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Footer action */}
        {invoice && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
          <div
            className="sticky bottom-0 px-5 py-4 flex gap-3"
            style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}
          >
            <AmberButton
              onClick={() => markPaid.mutate({ id: invoice.id })}
              disabled={markPaid.isPending}
              className="flex-1"
            >
              {markPaid.isPending ? 'Processing…' : '✓ Mark as Paid'}
            </AmberButton>
            <GhostButton onClick={onClose}>Close</GhostButton>
          </div>
        )}
        {invoice && (invoice.status === 'PAID' || invoice.status === 'CANCELLED') && (
          <div
            className="sticky bottom-0 px-5 py-4"
            style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}
          >
            <GhostButton onClick={onClose} className="w-full justify-center">Close</GhostButton>
          </div>
        )}
      </div>
    </div>
  );
}
