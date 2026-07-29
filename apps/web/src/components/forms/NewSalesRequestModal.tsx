'use client';

import { useState, useEffect } from 'react';
import { X, ShoppingCart } from 'lucide-react';
import { useClients } from '@/lib/hooks/useApi';
import { useSalesAction } from '@/lib/hooks/useControlChain';
import { AmberButton, GhostButton } from '@/components/ui';

interface Props { open: boolean; onClose: () => void; }
const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'];

export function NewSalesRequestModal({ open, onClose }: Props) {
  const action = useSalesAction();
  const { data: clientsData } = useClients({ page: 1, limit: 200, isBlocked: false });
  const clients = (clientsData as any)?.data ?? (Array.isArray(clientsData) ? clientsData : []);

  const [clientId, setClientId] = useState('');
  const [title,    setTitle]    = useState('');
  const [amount,   setAmount]   = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [description, setDescription] = useState('');
  const [submitNow, setSubmitNow] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setClientId(''); setTitle(''); setAmount(''); setCurrency('NGN');
      setDescription(''); setSubmitNow(true); setErrors({});
    }
  }, [open]);

  function validate() {
    const e: Record<string, string> = {};
    if (!clientId) e.clientId = 'Select a client';
    if (!title.trim()) e.title = 'Required';
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) e.amount = 'Enter a valid amount';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      await action.mutateAsync({
        action: 'create',
        payload: {
          clientId, title,
          requestedAmount: parseFloat(amount),
          currency,
          description: description || undefined,
          submit: submitNow,
        },
      });
      onClose();
    } catch { /* handled by mutation */ }
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
              <ShoppingCart size={15} style={{ color: 'var(--indigo-2)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>New Sales Request</h2>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Start of the transaction control chain</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70" style={{ background: 'var(--bg-3)' }}>
            <X size={14} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="form-label">Client</label>
            <select className="form-input" value={clientId} onChange={e => setClientId(e.target.value)}
              style={{ color: clientId ? 'var(--text)' : 'var(--text-3)' }}>
              <option value="" disabled>Select client…</option>
              {clients.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}{c.isBlocked ? ' (BLOCKED)' : ''}</option>
              ))}
            </select>
            {errors.clientId && <p className="form-error">{errors.clientId}</p>}
          </div>

          <div>
            <label className="form-label">Title</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Supply of 200 network routers" />
            {errors.title && <p className="form-error">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="form-label">Requested Amount</label>
              <input className="form-input mono" type="number" min="0" step="0.01" value={amount}
                onChange={e => setAmount(e.target.value)} placeholder="0.00" />
              {errors.amount && <p className="form-error">{errors.amount}</p>}
            </div>
            <div>
              <label className="form-label">Currency</label>
              <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Description <span style={{ color: 'var(--text-3)' }}>(optional)</span></label>
            <textarea className="form-input resize-none" rows={3} value={description}
              onChange={e => setDescription(e.target.value)} placeholder="Scope, PO reference, context…" />
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-2)' }}>
            <input type="checkbox" checked={submitNow} onChange={e => setSubmitNow(e.target.checked)} />
            Submit for approval immediately (otherwise saved as Draft)
          </label>
        </div>

        <div className="flex items-center justify-between px-6 py-4 sticky bottom-0"
          style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <AmberButton onClick={handleSubmit} disabled={action.isPending}>
            {action.isPending ? 'Saving…' : 'Create Request'}
          </AmberButton>
        </div>
      </div>
    </div>
  );
}
