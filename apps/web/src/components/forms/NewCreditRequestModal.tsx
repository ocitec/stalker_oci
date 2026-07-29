'use client';

import { useState, useEffect } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { useSalesRequests, useCreditAction } from '@/lib/hooks/useControlChain';
import { AmberButton, GhostButton } from '@/components/ui';
import { fmtCurrency } from '@/lib/utils';

interface Props { open: boolean; onClose: () => void; presetSalesRequestId?: string; }

export function NewCreditRequestModal({ open, onClose, presetSalesRequestId }: Props) {
  const action = useCreditAction();
  const { data: salesData } = useSalesRequests({ status: 'APPROVED', page: 1, limit: 200 });
  const approvedSales = salesData?.data ?? [];

  const [salesRequestId, setSalesRequestId] = useState('');
  const [amount, setAmount] = useState('');
  const [comments, setComments] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setSalesRequestId(presetSalesRequestId ?? '');
      setAmount(''); setComments(''); setErrors({});
    }
  }, [open, presetSalesRequestId]);

  const selected = approvedSales.find((s: any) => s.id === salesRequestId);

  async function handleSubmit() {
    if (!salesRequestId) { setErrors({ salesRequestId: 'Select an approved sales request' }); return; }
    try {
      await action.mutateAsync({
        action: 'create',
        payload: {
          salesRequestId,
          requestedAmount: amount ? parseFloat(amount) : undefined,
          comments: comments || undefined,
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
              <ShieldCheck size={15} style={{ color: 'var(--indigo-2)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>New Credit Request</h2>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Assess credit for an approved sales request</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70" style={{ background: 'var(--bg-3)' }}>
            <X size={14} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="form-label">Approved Sales Request</label>
            <select className="form-input" value={salesRequestId} onChange={e => setSalesRequestId(e.target.value)}
              style={{ color: salesRequestId ? 'var(--text)' : 'var(--text-3)' }}>
              <option value="" disabled>Select sales request…</option>
              {approvedSales.map((s: any) => (
                <option key={s.id} value={s.id}>{s.reference} — {s.client?.name} ({fmtCurrency(Number(s.requestedAmount), s.currency)})</option>
              ))}
            </select>
            {errors.salesRequestId && <p className="form-error">{errors.salesRequestId}</p>}
            {approvedSales.length === 0 && (
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--amber)' }}>No approved sales requests available. Approve one first.</p>
            )}
          </div>

          <div>
            <label className="form-label">
              Requested Credit Amount
              <span className="ml-1 normal-case font-normal" style={{ color: 'var(--text-3)' }}>
                (defaults to {selected ? fmtCurrency(Number(selected.requestedAmount), selected.currency) : 'sales amount'})
              </span>
            </label>
            <input className="form-input mono" type="number" min="0" step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="Leave blank to use sales amount" />
          </div>

          <div>
            <label className="form-label">Comments <span style={{ color: 'var(--text-3)' }}>(optional)</span></label>
            <textarea className="form-input resize-none" rows={3} value={comments}
              onChange={e => setComments(e.target.value)} placeholder="Credit notes, conditions…" />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 sticky bottom-0"
          style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <AmberButton onClick={handleSubmit} disabled={action.isPending || approvedSales.length === 0}>
            {action.isPending ? 'Saving…' : 'Open Assessment'}
          </AmberButton>
        </div>
      </div>
    </div>
  );
}
