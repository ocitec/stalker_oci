'use client';

import { useState, useEffect } from 'react';
import { X, Receipt, Calculator, CheckCircle2, ArrowRight } from 'lucide-react';
import { useClients } from '@/lib/hooks/useApi';
import { useReceiptOutstanding, usePreviewReceipt, useCreateReceipt } from '@/lib/hooks/useReceipts';
import { AmberButton, GhostButton, Badge } from '@/components/ui';
import { fmtCurrency, fmtDate, getStatusClass, getStatusLabel } from '@/lib/utils';

interface Props { open: boolean; onClose: () => void; }

const METHODS = ['', 'BANK_TRANSFER', 'CHEQUE', 'CASH', 'CARD', 'MOBILE_MONEY', 'OTHER'];
const today = () => new Date().toISOString().split('T')[0];

export function NewReceiptModal({ open, onClose }: Props) {
  const { data: clientsData } = useClients({ page: 1, limit: 200 });
  const clients = (clientsData as any)?.data ?? (Array.isArray(clientsData) ? clientsData : []);

  const [clientId, setClientId]   = useState('');
  const [amount, setAmount]       = useState('');
  const [method, setMethod]       = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes]         = useState('');
  const [payDate, setPayDate]     = useState(today());
  const [preview, setPreview]     = useState<any>(null);

  const { data: outstanding, isLoading: loadingOut } = useReceiptOutstanding(clientId || null);
  const previewMut = usePreviewReceipt();
  const createMut  = useCreateReceipt();

  // Reset on open
  useEffect(() => {
    if (open) {
      setClientId(''); setAmount(''); setMethod(''); setReference(''); setNotes('');
      setPayDate(today()); setPreview(null);
    }
  }, [open]);

  // Any change to client or amount invalidates a prior consolidation.
  useEffect(() => { setPreview(null); }, [clientId, amount]);

  if (!open) return null;

  const amountNum = parseFloat(amount);
  const canConsolidate = !!clientId && !isNaN(amountNum) && amountNum > 0;

  async function handleConsolidate() {
    if (!canConsolidate) return;
    const res = await previewMut.mutateAsync({ clientId, amount: amountNum });
    setPreview(res);
  }

  async function handleConfirm() {
    if (!preview) return;
    await createMut.mutateAsync({
      clientId, amount: amountNum,
      paymentDate: payDate || undefined,
      paymentMethod: method || undefined,
      paymentReference: reference || undefined,
      notes: notes || undefined,
    });
    onClose();
  }

  const totalOutstanding = outstanding?.totalOutstanding ?? 0;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="animate-scale-in w-full max-w-2xl rounded-xl"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <Receipt size={15} style={{ color: 'var(--indigo-2)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>New Receipt</h2>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Record a payment and auto-allocate it oldest → newest</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70" style={{ background: 'var(--bg-3)' }}>
            <X size={14} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Step 1 — client */}
          <div>
            <label className="form-label">Client</label>
            <select className="form-input" value={clientId} onChange={e => setClientId(e.target.value)}
              style={{ color: clientId ? 'var(--text)' : 'var(--text-3)' }}>
              <option value="" disabled>Select client…</option>
              {clients.map((c: any) => (
                <option key={c.id} value={c.id} style={{ color: '#E8EDF8', background: '#1A2236' }}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Step 2 — outstanding invoices */}
          {clientId && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--bg-2)' }}>
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Outstanding Invoices</span>
                <span className="text-xs mono font-bold" style={{ color: 'var(--text)' }}>{fmtCurrency(totalOutstanding)}</span>
              </div>
              {loadingOut ? (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-3)' }}>Loading…</p>
              ) : (outstanding?.invoices?.length ?? 0) === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-3)' }}>No outstanding invoices for this client.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth: 460 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Invoice', 'Date', 'Amount', 'Outstanding', 'Status'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-3)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {outstanding.invoices.map((inv: any) => (
                        <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-3 py-2 mono" style={{ color: 'var(--text-2)' }}>{inv.invoiceNumber}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-3)' }}>{fmtDate(inv.invoiceDate)}</td>
                          <td className="px-3 py-2 mono" style={{ color: 'var(--text-2)' }}>{fmtCurrency(inv.invoiceAmount)}</td>
                          <td className="px-3 py-2 mono font-semibold" style={{ color: 'var(--text)' }}>{fmtCurrency(inv.remainingBalance)}</td>
                          <td className="px-3 py-2"><Badge className={getStatusClass(inv.status)}>{getStatusLabel(inv.status)}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Step 3 — payment details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Payment Amount</label>
              <input className="form-input mono" type="number" min="0" step="0.01" value={amount}
                onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Payment Date</label>
              <input className="form-input" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Method <span style={{ color: 'var(--text-3)' }}>(optional)</span></label>
              <select className="form-input" value={method} onChange={e => setMethod(e.target.value)}>
                {METHODS.map(m => <option key={m} value={m}>{m ? m.replace('_', ' ') : 'Unspecified'}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Reference <span style={{ color: 'var(--text-3)' }}>(optional)</span></label>
              <input className="form-input" value={reference} onChange={e => setReference(e.target.value)} placeholder="Bank/cheque ref" />
            </div>
          </div>

          {/* Consolidate action */}
          {!preview && (
            <AmberButton onClick={handleConsolidate} disabled={!canConsolidate || previewMut.isPending} className="w-full justify-center">
              <Calculator size={13} className="inline mr-1" />
              {previewMut.isPending ? 'Calculating…' : 'Consolidate Payment'}
            </AmberButton>
          )}

          {/* Step 4 — review allocation */}
          {preview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Proposed Allocation</span>
                <ArrowRight size={12} style={{ color: 'var(--text-3)' }} />
                <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>review before confirming</span>
              </div>
              <div className="rounded-xl overflow-hidden overflow-x-auto" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-xs" style={{ minWidth: 520 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                      {['Invoice', 'Amount', 'Allocated', 'New Balance', 'Status'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.allocations.map((a: any) => (
                      <tr key={a.invoiceId} style={{ borderBottom: '1px solid var(--border)', opacity: a.allocated > 0 ? 1 : 0.55 }}>
                        <td className="px-3 py-2 mono" style={{ color: 'var(--text-2)' }}>{a.invoiceNumber}</td>
                        <td className="px-3 py-2 mono" style={{ color: 'var(--text-3)' }}>{fmtCurrency(a.invoiceAmount)}</td>
                        <td className="px-3 py-2 mono font-bold" style={{ color: a.allocated > 0 ? '#10B981' : 'var(--text-3)' }}>{fmtCurrency(a.allocated)}</td>
                        <td className="px-3 py-2 mono" style={{ color: 'var(--text-2)' }}>{fmtCurrency(a.newRemaining)}</td>
                        <td className="px-3 py-2">
                          <Badge className={getStatusClass(a.allocated > 0 ? a.newStatus : a.previousStatus)}>
                            {getStatusLabel(a.allocated > 0 ? a.newStatus : a.previousStatus)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg text-center" style={{ background: 'var(--bg-2)' }}>
                  <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Total Received</p>
                  <p className="mono text-sm font-bold" style={{ color: 'var(--text)' }}>{fmtCurrency(preview.totalAmount)}</p>
                </div>
                <div className="p-2.5 rounded-lg text-center" style={{ background: 'rgba(16,185,129,0.08)' }}>
                  <p className="text-[10px]" style={{ color: '#10B981' }}>Allocated</p>
                  <p className="mono text-sm font-bold" style={{ color: '#10B981' }}>{fmtCurrency(preview.allocatedAmount)}</p>
                </div>
                <div className="p-2.5 rounded-lg text-center" style={{ background: preview.unallocatedAmount > 0 ? 'rgba(245,158,11,0.1)' : 'var(--bg-2)' }}>
                  <p className="text-[10px]" style={{ color: preview.unallocatedAmount > 0 ? '#F59E0B' : 'var(--text-3)' }}>Unallocated</p>
                  <p className="mono text-sm font-bold" style={{ color: preview.unallocatedAmount > 0 ? '#F59E0B' : 'var(--text-3)' }}>{fmtCurrency(preview.unallocatedAmount)}</p>
                </div>
              </div>
              {preview.unallocatedAmount > 0 && (
                <p className="text-[11px] px-1" style={{ color: '#F59E0B' }}>
                  Payment exceeds total outstanding by {fmtCurrency(preview.unallocatedAmount)} — retained as an unallocated overpayment.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 sticky bottom-0"
          style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          {preview && (
            <AmberButton onClick={handleConfirm} disabled={createMut.isPending}>
              <CheckCircle2 size={13} className="inline mr-1" />
              {createMut.isPending ? 'Recording…' : 'Confirm Receipt'}
            </AmberButton>
          )}
        </div>
      </div>
    </div>
  );
}
