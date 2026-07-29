'use client';

import { useState, useEffect } from 'react';
import { X, ArrowLeftRight } from 'lucide-react';
import { useCreditRequests, useTransactionAction } from '@/lib/hooks/useControlChain';
import { AmberButton, GhostButton } from '@/components/ui';
import { fmtCurrency } from '@/lib/utils';

interface Props { open: boolean; onClose: () => void; presetCreditRequestId?: string; }
const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'];

export function NewTransactionModal({ open, onClose, presetCreditRequestId }: Props) {
  const action = useTransactionAction();
  const { data: creditData } = useCreditRequests({ status: 'APPROVED', page: 1, limit: 200 });
  const approvedCredit = creditData?.data ?? [];

  const [creditRequestId, setCreditRequestId] = useState('');
  const [value,    setValue]    = useState('');
  const [cost,     setCost]     = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [srf,      setSrf]      = useState('');
  const [source,   setSource]   = useState('');
  const [submitNow, setSubmitNow] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setCreditRequestId(presetCreditRequestId ?? '');
      setValue(''); setCost(''); setCurrency('NGN'); setSrf(''); setSource(''); setSubmitNow(true); setErrors({});
    }
  }, [open, presetCreditRequestId]);

  const selected = approvedCredit.find((c: any) => c.id === creditRequestId);

  // Default the transaction value to the approved credit amount when a request is picked.
  useEffect(() => {
    if (selected && !value) setValue(String(Number(selected.approvedAmount ?? selected.requestedAmount)));
    if (selected?.currency) setCurrency(selected.currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditRequestId]);

  const v = parseFloat(value) || 0;
  const c = parseFloat(cost) || 0;
  const margin = v - c;
  const profitPct = v > 0 ? (margin / v) * 100 : 0;

  function validate() {
    const e: Record<string, string> = {};
    if (!creditRequestId) e.creditRequestId = 'Select an approved credit request';
    if (!value || v <= 0) e.value = 'Enter a valid amount';
    if (c < 0) e.cost = 'Cannot be negative';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      await action.mutateAsync({
        action: 'create',
        payload: {
          creditRequestId,
          newTransactionValue: v,
          supplierCost: c,
          currency,
          srfNumber: srf || undefined,
          paymentSource: source || undefined,
          submit: submitNow,
        },
      });
      onClose();
    } catch { /* handled */ }
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="animate-scale-in w-full max-w-lg rounded-xl"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-6 py-4 sticky top-0"
          style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <ArrowLeftRight size={15} style={{ color: 'var(--indigo-2)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>New Transaction</h2>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Created from an approved credit request</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70" style={{ background: 'var(--bg-3)' }}>
            <X size={14} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="form-label">Approved Credit Request</label>
            <select className="form-input" value={creditRequestId} onChange={e => setCreditRequestId(e.target.value)}
              style={{ color: creditRequestId ? 'var(--text)' : 'var(--text-3)' }}>
              <option value="" disabled>Select credit request…</option>
              {approvedCredit.map((c: any) => (
                <option key={c.id} value={c.id}>{c.reference} — {c.client?.name} ({fmtCurrency(Number(c.approvedAmount ?? c.requestedAmount), c.currency)})</option>
              ))}
            </select>
            {errors.creditRequestId && <p className="form-error">{errors.creditRequestId}</p>}
            {approvedCredit.length === 0 && (
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--amber)' }}>No approved credit requests available. Approve one first.</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="form-label">Transaction Value</label>
              <input className="form-input mono" type="number" min="0" step="0.01" value={value}
                onChange={e => setValue(e.target.value)} placeholder="0.00" />
              {errors.value && <p className="form-error">{errors.value}</p>}
            </div>
            <div>
              <label className="form-label">Currency</label>
              <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(cc => <option key={cc} value={cc}>{cc}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Supplier Cost</label>
            <input className="form-input mono" type="number" min="0" step="0.01" value={cost}
              onChange={e => setCost(e.target.value)} placeholder="0.00" />
            {errors.cost && <p className="form-error">{errors.cost}</p>}
          </div>

          {/* Live margin preview */}
          <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>Gross margin</span>
            <span className="mono text-sm font-bold" style={{ color: margin >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmtCurrency(margin, currency)} <span className="text-[11px] font-normal" style={{ color: 'var(--text-3)' }}>({profitPct.toFixed(1)}%)</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">SRF Number <span style={{ color: 'var(--text-3)' }}>(auto)</span></label>
              <input className="form-input mono" value={srf} onChange={e => setSrf(e.target.value)} placeholder="Auto-generated" />
            </div>
            <div>
              <label className="form-label">Payment Source <span style={{ color: 'var(--text-3)' }}>(optional)</span></label>
              <input className="form-input" value={source} onChange={e => setSource(e.target.value)} placeholder="Bank, cheque…" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-2)' }}>
            <input type="checkbox" checked={submitNow} onChange={e => setSubmitNow(e.target.checked)} />
            Submit for review immediately (otherwise saved as Draft)
          </label>
        </div>

        <div className="flex items-center justify-between px-6 py-4 sticky bottom-0"
          style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <AmberButton onClick={handleSubmit} disabled={action.isPending || approvedCredit.length === 0}>
            {action.isPending ? 'Saving…' : 'Create Transaction'}
          </AmberButton>
        </div>
      </div>
    </div>
  );
}
