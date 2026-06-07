'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X, FileText, CheckCircle2, Clock, RotateCcw,
  ChevronDown, AlertTriangle, DollarSign, Calendar, User,
} from 'lucide-react';
import { useInvoice, useMarkPaid, useRevertPayment } from '@/lib/hooks/useApi';
import { Badge, AmberButton, GhostButton, SkeletonCard } from '@/components/ui';
import {
  fmtCurrency, fmtDate, fmtDateTime, fmtRelative,
  getStatusColor, getStatusLabel, getStatusClass,
  getPdiColor, getFollowUpColor, calcPaymentPct,
  getPaymentProgressColor,
} from '@/lib/utils';
import { Invoice, PaymentRecord, FollowUpType, InvoiceStatus, FollowUp } from '@/types';

// ── Follow-up type icons ──────────────────────────────────────────────────
const FU_ICON: Record<FollowUpType, string> = {
  EMAIL: '✉', PHONE: '📞', WHATSAPP: '💬',
  IN_PERSON: '🤝', ESCALATION: '🚨', LETTER: '📄',
};

// ── Quick-amount presets ──────────────────────────────────────────────────
function makePresets(remaining: number) {
  return [
    { label: '25%',  value: +(remaining * 0.25).toFixed(2) },
    { label: '50%',  value: +(remaining * 0.5).toFixed(2) },
    { label: '75%',  value: +(remaining * 0.75).toFixed(2) },
    { label: 'Full', value: remaining },
  ];
}

// ── Revert confirm dialog ─────────────────────────────────────────────────
function RevertConfirm({
  payment,
  onConfirm,
  onCancel,
  loading,
}: {
  payment: PaymentRecord;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="p-4 rounded-lg space-y-3" style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.25)' }}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={13} style={{ color: '#F43F5E', flexShrink: 0 }} />
        <p className="text-xs font-semibold" style={{ color: '#F43F5E' }}>
          Revert payment of {fmtCurrency(Number(payment.amount))}?
        </p>
      </div>
      <p className="text-[11px]" style={{ color: 'var(--text-2)' }}>
        This will reduce the invoice balance by {fmtCurrency(Number(payment.amount))} and restore its previous status.
        The payment record is preserved in the audit trail.
      </p>
      <textarea
        className="form-input resize-none text-xs"
        rows={2}
        placeholder="Reason for reverting (optional)…"
        value={reason}
        onChange={e => setReason(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(reason)}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
          style={{ background: '#F43F5E', color: '#fff' }}
        >
          {loading ? 'Reverting…' : 'Confirm Revert'}
        </button>
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
      </div>
    </div>
  );
}

// ── Payment History entry ─────────────────────────────────────────────────
function PaymentHistoryItem({
  payment,
  isRevertable,
  onRevertClick,
}: {
  payment:       PaymentRecord;
  isRevertable:  boolean;
  onRevertClick: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg"
      style={{
        background:  payment.isReverted ? 'transparent' : 'var(--bg-2)',
        border:      `1px solid ${payment.isReverted ? 'var(--border)' : 'rgba(16,185,129,0.2)'}`,
        opacity:     payment.isReverted ? 0.55 : 1,
      }}
    >
      {/* Amount */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span
            className="mono text-sm font-bold"
            style={{ color: payment.isReverted ? 'var(--text-3)' : '#10B981' }}
          >
            {payment.isReverted && <span className="text-xs mr-1" style={{ color: '#F43F5E' }}>REVERTED</span>}
            {fmtCurrency(Number(payment.amount))}
          </span>
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-3)' }}>
            {fmtDateTime(payment.paymentDate)}
          </span>
        </div>
        {payment.user && (
          <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
            Recorded by {payment.user.name}
          </p>
        )}
        {payment.notes && (
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {payment.notes}
          </p>
        )}
        {payment.isReverted && payment.revertedAt && (
          <p className="text-[10px] mt-1" style={{ color: '#F43F5E' }}>
            Reverted {fmtRelative(payment.revertedAt)}
          </p>
        )}
      </div>

      {/* Revert action — only visible on the most recent non-reverted payment */}
      {isRevertable && (
        <button
          onClick={onRevertClick}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold flex-shrink-0 hover:opacity-80 transition-all"
          style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E' }}
          title="Revert this payment"
        >
          <RotateCcw size={10} />
          Revert
        </button>
      )}
    </div>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────
interface Props {
  invoiceId: string | null;
  onClose:   () => void;
}

export function InvoiceDrawer({ invoiceId, onClose }: Props) {
  const { data: invoice, isLoading } = useInvoice(invoiceId ?? '');
  const markPaid      = useMarkPaid();
  const revertPayment = useRevertPayment();

  // ── Local UI state ────────────────────────────────────────────────────
  const [paymentInput, setPaymentInput]   = useState('');
  const [paymentDate,  setPaymentDate]    = useState(todayStr());
  const [paymentNotes, setPaymentNotes]   = useState('');
  const [inputError,   setInputError]     = useState('');
  const [revertTarget, setRevertTarget]   = useState<PaymentRecord | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // Reset form whenever the drawer opens for a new invoice
  useEffect(() => {
    setPaymentInput('');
    setPaymentDate(todayStr());
    setPaymentNotes('');
    setInputError('');
    setRevertTarget(null);
  }, [invoiceId]);

  if (!invoiceId) return null;

  // ── Derived payment data ──────────────────────────────────────────────
  const totalAmount    = Number(invoice?.invoiceAmount ?? 0);
  const amountPaid     = Number(invoice?.amountPaid    ?? 0);
  const remaining      = Number(invoice?.remainingBalance ?? (totalAmount - amountPaid));
  const progressPct    = calcPaymentPct(totalAmount, amountPaid);
  const statusColor    = invoice ? getStatusColor(invoice.status) : 'var(--text-3)';
  const isSettled      = invoice?.status === 'PAID' || invoice?.status === 'CANCELLED';

  // Payments: desc order, active ones first
  const allPayments    = (invoice?.payments ?? []) as PaymentRecord[];
  const activePayments = allPayments.filter(p => !p.isReverted);
  const revertablePayment = activePayments[0] ?? null;  // most recent active

  // Can the current user revert? Shown whenever there's an active payment
  const canRevert = !!revertablePayment && invoice?.status !== 'CANCELLED';

  // ── Handlers ─────────────────────────────────────────────────────────
  function validateAmount(raw: string): { ok: boolean; value?: number } {
    const v = parseFloat(raw);
    if (!raw || isNaN(v) || v <= 0) {
      setInputError('Enter an amount greater than zero');
      return { ok: false };
    }
    if (v > remaining + 0.005) {
      setInputError(`Amount cannot exceed the remaining balance (${fmtCurrency(remaining)})`);
      return { ok: false };
    }
    setInputError('');
    return { ok: true, value: v };
  }

  function handlePreset(value: number) {
    setPaymentInput(value.toFixed(2));
    setInputError('');
    amountRef.current?.focus();
  }

  async function handleSubmitPayment() {
    const { ok, value } = validateAmount(paymentInput);
    if (!ok || !invoice) return;
    await markPaid.mutateAsync({
      id:            invoice.id,
      paymentAmount: value,
      paymentDate,
      notes:         paymentNotes || undefined,
    });
    setPaymentInput('');
    setPaymentNotes('');
    setPaymentDate(todayStr());
  }

  async function handleConfirmRevert(reason: string) {
    if (!invoice || !revertTarget) return;
    await revertPayment.mutateAsync({
      invoiceId:       invoice.id,
      paymentRecordId: revertTarget.id,
      reason:          reason || undefined,
    });
    setRevertTarget(null);
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="drawer-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="animate-slide-right h-full flex flex-col"
        style={{ width: 480, background: 'var(--bg-1)', borderLeft: '1px solid var(--border)', overflowY: 'auto' }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <FileText size={15} style={{ color: 'var(--amber)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {invoice?.invoiceNumber ?? 'Invoice Detail'}
            </span>
            {invoice && (
              <Badge className={getStatusClass(invoice.status)}>
                {getStatusLabel(invoice.status)}
              </Badge>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70 transition-all"
            style={{ background: 'var(--bg-3)' }}
          >
            <X size={14} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
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

            {/* ── Payment Summary Card ──────────────────────────────── */}
            <div
              className="p-4 rounded-xl space-y-3"
              style={{ background: 'var(--bg-2)', border: `1px solid ${statusColor}33` }}
            >
              {/* Amount row */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
                    Invoice Total
                  </p>
                  <p className="mono text-2xl font-black" style={{ color: 'var(--text)' }}>
                    {fmtCurrency(totalAmount)}
                  </p>
                </div>
                {invoice.status === 'PARTIALLY_PAID' && (
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
                      Remaining
                    </p>
                    <p className="mono text-xl font-bold" style={{ color: '#F59E0B' }}>
                      {fmtCurrency(remaining)}
                    </p>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1.5">
                  <span style={{ color: 'var(--text-3)' }}>
                    Paid: <span className="mono font-bold" style={{ color: '#10B981' }}>{fmtCurrency(amountPaid)}</span>
                  </span>
                  <span className="mono font-bold" style={{ color: getPaymentProgressColor(progressPct) }}>
                    {progressPct}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full" style={{ background: 'var(--bg-3)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width:      `${progressPct}%`,
                      background: getPaymentProgressColor(progressPct),
                      minWidth:   progressPct > 0 ? 8 : 0,
                    }}
                  />
                </div>
              </div>

              {/* Status details */}
              <div className="flex gap-3">
                {amountPaid > 0 && (
                  <div className="flex-1 p-2 rounded-lg text-center" style={{ background: 'rgba(16,185,129,0.08)' }}>
                    <p className="text-[10px]" style={{ color: '#10B981' }}>Paid</p>
                    <p className="mono text-xs font-bold" style={{ color: '#10B981' }}>{fmtCurrency(amountPaid)}</p>
                  </div>
                )}
                {!isSettled && remaining > 0 && (
                  <div className="flex-1 p-2 rounded-lg text-center" style={{ background: 'rgba(245,158,11,0.08)' }}>
                    <p className="text-[10px]" style={{ color: '#F59E0B' }}>Outstanding</p>
                    <p className="mono text-xs font-bold" style={{ color: '#F59E0B' }}>{fmtCurrency(remaining)}</p>
                  </div>
                )}
                {invoice.daysOverdue != null && invoice.daysOverdue > 0 && (
                  <div className="flex-1 p-2 rounded-lg text-center" style={{ background: 'rgba(244,63,94,0.08)' }}>
                    <p className="text-[10px]" style={{ color: '#F43F5E' }}>Overdue</p>
                    <p className="mono text-xs font-bold" style={{ color: '#F43F5E' }}>{invoice.daysOverdue}d</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Invoice Details ───────────────────────────────────── */}
            <div>
              <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                Invoice Details
              </p>
              <div style={{ background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                {[
                  { icon: <User size={11} />,      label: 'Client',      value: invoice.client?.name ?? '—' },
                  { icon: <Calendar size={11} />,  label: 'Issued',      value: fmtDate(invoice.invoiceDate) },
                  { icon: <Calendar size={11} />,  label: 'Due',         value: fmtDate(invoice.dueDate) },
                  ...(invoice.paidDate
                    ? [{ icon: <CheckCircle2 size={11} />, label: 'Paid on', value: fmtDate(invoice.paidDate) }]
                    : []),
                  { icon: <DollarSign size={11} />, label: 'Currency',   value: invoice.currency },
                ].map((row, i, arr) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 text-xs"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <span className="flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                      {row.icon}{row.label}
                    </span>
                    <span className="font-medium" style={{ color: 'var(--text)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Record Payment ────────────────────────────────────── */}
            {!isSettled && remaining > 0.005 && (
              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                  Record Payment
                </p>
                <div
                  className="p-4 rounded-xl space-y-3"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
                >
                  {/* Quick presets */}
                  <div>
                    <p className="text-[10px] mb-2" style={{ color: 'var(--text-3)' }}>Quick amount</p>
                    <div className="flex gap-2 flex-wrap">
                      {makePresets(remaining).map(preset => (
                        <button
                          key={preset.label}
                          onClick={() => handlePreset(preset.value)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                          style={{
                            background: preset.label === 'Full' ? 'rgba(16,185,129,0.15)' : 'var(--bg-3)',
                            color:      preset.label === 'Full' ? '#10B981' : 'var(--text-2)',
                            border:     `1px solid ${preset.label === 'Full' ? 'rgba(16,185,129,0.3)' : 'transparent'}`,
                          }}
                        >
                          {preset.label}
                          <span className="mono ml-1 text-[10px] opacity-70">
                            ({fmtCurrency(preset.value)})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount input */}
                  <div>
                    <label className="form-label">Payment Amount (₦)</label>
                    <input
                      ref={amountRef}
                      className="form-input mono"
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={remaining}
                      value={paymentInput}
                      onChange={e => {
                        setPaymentInput(e.target.value);
                        setInputError('');
                      }}
                      placeholder={`Up to ${fmtCurrency(remaining)}`}
                    />
                    {inputError && <p className="form-error">{inputError}</p>}
                    {paymentInput && !inputError && parseFloat(paymentInput) > 0 && (
                      <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-3)' }}>
                        After this payment:{' '}
                        <span className="mono font-bold" style={{ color: '#F59E0B' }}>
                          {fmtCurrency(Math.max(0, remaining - parseFloat(paymentInput)))} remaining
                        </span>
                        {parseFloat(paymentInput) >= remaining - 0.005 && (
                          <span className="ml-1 font-bold" style={{ color: '#10B981' }}>
                            — invoice fully settled ✓
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Payment date */}
                  <div>
                    <label className="form-label">Payment Date</label>
                    <input
                      className="form-input"
                      type="date"
                      value={paymentDate}
                      onChange={e => setPaymentDate(e.target.value)}
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="form-label">Notes <span style={{ color: 'var(--text-3)' }}>(optional)</span></label>
                    <textarea
                      className="form-input resize-none text-xs"
                      rows={2}
                      value={paymentNotes}
                      onChange={e => setPaymentNotes(e.target.value)}
                      placeholder="Ref number, bank, context…"
                    />
                  </div>

                  {/* Submit */}
                  <AmberButton
                    onClick={handleSubmitPayment}
                    disabled={markPaid.isPending || !paymentInput}
                    className="w-full justify-center"
                  >
                    {markPaid.isPending
                      ? 'Recording…'
                      : paymentInput && parseFloat(paymentInput) >= remaining - 0.005
                        ? '✓ Mark as Fully Paid'
                        : '✓ Record Partial Payment'}
                  </AmberButton>
                </div>
              </div>
            )}

            {/* ── Payment History ───────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                  Payment History
                </p>
                {activePayments.length > 0 && (
                  <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                    {activePayments.length} payment{activePayments.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {allPayments.length === 0 ? (
                <div
                  className="p-4 rounded-lg text-center text-xs"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
                >
                  <Clock size={20} className="mx-auto mb-2 opacity-40" />
                  No payments recorded yet
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Revert confirm — shown inline above the target payment */}
                  {revertTarget && revertTarget.id === revertablePayment?.id && (
                    <RevertConfirm
                      payment={revertTarget}
                      onConfirm={handleConfirmRevert}
                      onCancel={() => setRevertTarget(null)}
                      loading={revertPayment.isPending}
                    />
                  )}
                  {allPayments.map((payment, i) => (
                    <PaymentHistoryItem
                      key={payment.id}
                      payment={payment}
                      isRevertable={
                        canRevert &&
                        payment.id === revertablePayment?.id &&
                        revertTarget === null
                      }
                      onRevertClick={() => setRevertTarget(payment)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Notes ────────────────────────────────────────────── */}
            {invoice.notes && (
              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                  Notes
                </p>
                <div
                  className="p-3 rounded-lg text-xs leading-relaxed"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                >
                  {invoice.notes}
                </div>
              </div>
            )}

            {/* ── Follow-up Timeline ────────────────────────────────── */}
            {(invoice.followUps?.length ?? 0) > 0 && (
              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                  Follow-up History
                </p>
                <div className="space-y-2">
                  {invoice.followUps!.map((fu: FollowUp) => (
                    <div
                      key={fu.id}
                      className="flex gap-3 p-3 rounded-lg text-xs"
                      style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                        style={{ background: 'var(--bg-3)' }}
                      >
                        {FU_ICON[fu.followUpType] ?? '📋'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-semibold" style={{ color: 'var(--text)' }}>{fu.followUpType}</span>
                          <span style={{ color: 'var(--text-3)' }}>{fmtDate(fu.followUpDate)}</span>
                        </div>
                        {fu.user && <p style={{ color: 'var(--text-3)' }}>by {fu.user.name}</p>}
                        {fu.notes && (
                          <p className="mt-1 leading-relaxed" style={{ color: 'var(--text-2)' }}>{fu.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div
          className="sticky bottom-0 px-5 py-3 flex items-center justify-between gap-3"
          style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}
        >
          {invoice?.status === 'PAID' ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} style={{ color: '#10B981' }} />
              <span className="text-xs font-semibold" style={{ color: '#10B981' }}>
                Fully paid · {fmtDate(invoice.paidDate)}
              </span>
            </div>
          ) : invoice?.status === 'PARTIALLY_PAID' ? (
            <div className="text-xs" style={{ color: 'var(--text-3)' }}>
              <span className="mono font-bold" style={{ color: '#3B82F6' }}>{progressPct}%</span>
              {' '}paid · {fmtCurrency(remaining)} remaining
            </div>
          ) : (
            <div />
          )}
          <GhostButton onClick={onClose}>Close</GhostButton>
        </div>
      </div>
    </div>
  );
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}