'use client';

import { useState, useEffect } from 'react';
import { X, Building2 } from 'lucide-react';
import { useCreateClient } from '@/lib/hooks/useApi';
import { AmberButton, GhostButton } from '@/components/ui';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SECTORS = [
  'Manufacturing', 'Retail & Trade', 'Oil & Gas', 'Banking & Finance',
  'Telecoms', 'FMCG', 'Construction', 'Healthcare', 'Agriculture',
  'Technology', 'Logistics', 'Real Estate', 'Education', 'Other',
];

interface FormData {
  name:                 string;
  email:                string;
  phone:                string;
  sector:               string;
  companyRegistration:  string;
  creditLimit:          string;
  slaDays:              string;
  notes:                string;
}

const EMPTY: FormData = {
  name:                '',
  email:               '',
  phone:               '',
  sector:              '',
  companyRegistration: '',
  creditLimit:         '',
  slaDays:             '30',
  notes:               '',
};

export function AddClientModal({ open, onClose }: Props) {
  const createClient = useCreateClient();
  const [form,   setForm]   = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormData>>({});

  // Reset on open
  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setErrors({});
    }
  }, [open]);

  function set(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  }

  function validate(): boolean {
    const e: Partial<FormData> = {};
    if (!form.name.trim())           e.name        = 'Client name is required';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
                                     e.email       = 'Enter a valid email address';
    if (!form.creditLimit || isNaN(Number(form.creditLimit)) || Number(form.creditLimit) <= 0)
                                     e.creditLimit = 'Enter a valid credit limit';
    if (!form.slaDays || isNaN(Number(form.slaDays)) || Number(form.slaDays) < 1 || Number(form.slaDays) > 365)
                                     e.slaDays     = 'SLA days must be 1–365';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      await createClient.mutateAsync({
        name:                form.name.trim(),
        email:               form.email   || undefined,
        phone:               form.phone   || undefined,
        sector:              form.sector  || undefined,
        companyRegistration: form.companyRegistration || undefined,
        creditLimit:         parseFloat(form.creditLimit),
        slaDays:             parseInt(form.slaDays, 10),
        notes:               form.notes   || undefined,
      });
      onClose();
    } catch {
      // handled by mutation's onError
    }
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="animate-scale-in w-full max-w-lg rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0"
          style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', zIndex: 10 }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.12)' }}
            >
              <Building2 size={15} style={{ color: 'var(--indigo-2)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Add Client</h2>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Register a new corporate client</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70 transition-all"
            style={{ background: 'var(--bg-3)' }}
          >
            <X size={14} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Company name */}
          <div>
            <label className="form-label">Company Name *</label>
            <input
              className="form-input"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Apex Holdings Ltd"
            />
            {errors.name && <p className="form-error">{errors.name}</p>}
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="accounts@company.com"
              />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+234 800 000 0000"
              />
            </div>
          </div>

          {/* Sector */}
          <div>
            <label className="form-label">Sector</label>
            <select
              className="form-input"
              value={form.sector}
              onChange={e => set('sector', e.target.value)}
            >
              <option value="">Select sector…</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Company Reg */}
          <div>
            <label className="form-label">Company Registration Number</label>
            <input
              className="form-input mono"
              value={form.companyRegistration}
              onChange={e => set('companyRegistration', e.target.value)}
              placeholder="RC-0000000"
            />
          </div>

          {/* Credit limit + SLA days */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Credit Limit (₦) *</label>
              <input
                className="form-input mono"
                type="number"
                min="0"
                step="1000"
                value={form.creditLimit}
                onChange={e => set('creditLimit', e.target.value)}
                placeholder="5,000,000"
              />
              {errors.creditLimit && <p className="form-error">{errors.creditLimit}</p>}
            </div>
            <div>
              <label className="form-label">SLA Days *</label>
              <input
                className="form-input mono"
                type="number"
                min="1"
                max="365"
                value={form.slaDays}
                onChange={e => set('slaDays', e.target.value)}
                placeholder="30"
              />
              {errors.slaDays && <p className="form-error">{errors.slaDays}</p>}
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>
                Days before invoice due date after issue
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Notes <span style={{ color: 'var(--text-3)' }}>(optional)</span></label>
            <textarea
              className="form-input resize-none"
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Internal notes, risk flags, key contacts…"
            />
          </div>

          {/* Credit info box */}
          {form.creditLimit && !isNaN(Number(form.creditLimit)) && Number(form.creditLimit) > 0 && (
            <div
              className="p-3 rounded-lg text-xs"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <p style={{ color: 'var(--text-2)' }}>
                Client starts with PDI <span className="mono font-bold" style={{ color: 'var(--amber)' }}>50</span> (Moderate).
                PDI updates automatically with each invoice payment.
                Auto-block triggers at PDI below 30.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 sticky bottom-0"
          style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}
        >
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <AmberButton onClick={handleSubmit} disabled={createClient.isPending}>
            {createClient.isPending ? 'Creating…' : 'Add Client'}
          </AmberButton>
        </div>
      </div>
    </div>
  );
}
