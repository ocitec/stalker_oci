'use client';

import { useState, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { useCreateInvoice, useClients } from '@/lib/hooks/useApi';
import { AmberButton, GhostButton } from '@/components/ui';

interface Props { open: boolean; onClose: () => void; }

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'];

function genInvoiceNo() {
  const d = new Date();
  return `INV-${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,'0')}-${Math.floor(1000+Math.random()*9000)}`;
}
function today() { return new Date().toISOString().split('T')[0]; }

export function NewInvoiceModal({ open, onClose }: Props) {
  const createInvoice              = useCreateInvoice();
  const { data: clientsData }      = useClients({ page: 1, limit: 200, isBlocked: false }); // Only active clients for invoicing
  const clients                    = (clientsData as any)?.data ?? (Array.isArray(clientsData) ? clientsData : []);

  const [invoiceNumber, setInvoiceNumber] = useState(genInvoiceNo);
  const [clientId,      setClientId]      = useState('');
  const [amount,        setAmount]        = useState('');
  const [currency,      setCurrency]      = useState('NGN');
  const [invoiceDate,   setInvoiceDate]   = useState(today());
  const [dueDate,       setDueDate]       = useState('');
  const [notes,         setNotes]         = useState('');
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  const selectedClient = clients.find((c: any) => c.id === clientId);

  // Auto-calculate due date from client SLA when clientId or invoiceDate changes
  useEffect(() => {
    if (selectedClient && invoiceDate) {
      const d = new Date(invoiceDate);
      d.setDate(d.getDate() + (selectedClient.slaDays ?? 30));
      setDueDate(d.toISOString().split('T')[0]);
    }
  }, [clientId, invoiceDate]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setInvoiceNumber(genInvoiceNo());
      setClientId(''); setAmount(''); setCurrency('NGN');
      setInvoiceDate(today()); setDueDate(''); setNotes(''); setErrors({});
    }
  }, [open]);

  function validate() {
    const e: Record<string, string> = {};
    if (!invoiceNumber.trim())                                    e.invoiceNumber = 'Required';
    if (!clientId)                                                e.clientId      = 'Select a client';
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) e.amount        = 'Enter a valid amount';
    if (!invoiceDate)                                             e.invoiceDate   = 'Required';
    if (!dueDate)                                                 e.dueDate       = 'Required';
    if (dueDate && dueDate < invoiceDate)                         e.dueDate       = 'Cannot be before invoice date';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      await createInvoice.mutateAsync({
        invoiceNumber,
        clientId,
        invoiceAmount: parseFloat(amount),
        currency,
        invoiceDate,
        dueDate,
        notes: notes || undefined,
      });
      onClose();
    } catch { /* handled by mutation */ }
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="animate-scale-in w-full max-w-lg rounded-xl"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0" style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <FileText size={15} style={{ color: 'var(--indigo-2)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>New Invoice</h2>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Create a new invoice for a client</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70" style={{ background: 'var(--bg-3)' }}>
            <X size={14} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Invoice number */}
          <div>
            <label className="form-label">Invoice Number</label>
            <input className="form-input mono" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="INV-2501-0001" />
            {errors.invoiceNumber && <p className="form-error">{errors.invoiceNumber}</p>}
          </div>

          {/* Client — native select (reliable across all browsers) */}
          <div>
            <label className="form-label">Client</label>
            <select
              className="form-input"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              style={{ color: clientId ? 'var(--text)' : 'var(--text-3)' }}
            >
              <option value="" disabled>Select client…</option>
              {clients.map((c: any) => (
                <option key={c.id} value={c.id} style={{ color: '#E8EDF8', background: '#1A2236' }}>
                  {c.name}{c.isBlocked ? ' (BLOCKED)' : ''}
                </option>
              ))}
            </select>
            {errors.clientId && <p className="form-error">{errors.clientId}</p>}
            {selectedClient && (
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-3)' }}>
                PDI <span className="mono font-bold" style={{ color: 'var(--amber)' }}>
                  {Math.round(Number(selectedClient.paymentDisciplineIndex))}
                </span>
                {' · '}SLA <span className="mono">{selectedClient.slaDays}d</span>
                {' · '}Credit{' '}
                <span className="mono">
                  {new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',minimumFractionDigits:0}).format(Number(selectedClient.creditLimit))}
                </span>
              </p>
            )}
          </div>

          {/* Amount + currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="form-label">Amount</label>
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

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Invoice Date</label>
              <input className="form-input" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
              {errors.invoiceDate && <p className="form-error">{errors.invoiceDate}</p>}
            </div>
            <div>
              <label className="form-label">
                Due Date{selectedClient && <span className="ml-1 normal-case font-normal" style={{ color: 'var(--text-3)' }}>(auto from SLA)</span>}
              </label>
              <input className="form-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              {errors.dueDate && <p className="form-error">{errors.dueDate}</p>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Notes <span style={{ color: 'var(--text-3)' }}>(optional)</span></label>
            <textarea className="form-input resize-none" rows={3} value={notes}
              onChange={e => setNotes(e.target.value)} placeholder="PO reference, project code, context…" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 sticky bottom-0" style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <AmberButton onClick={handleSubmit} disabled={createInvoice.isPending}>
            {createInvoice.isPending ? 'Creating…' : 'Create Invoice'}
          </AmberButton>
        </div>
      </div>
    </div>
  );
} 