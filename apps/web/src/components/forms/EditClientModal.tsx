'use client';

import { useState, useEffect } from 'react';
import { X, Building2 } from 'lucide-react';
import { useUpdateClient } from '@/lib/hooks/useApi';
import { AmberButton, GhostButton } from '@/components/ui';
import { Client } from '@/types';

interface Props { client: Client | null; onClose: () => void; }

const SECTORS = [
  'Manufacturing','Retail & Trade','Oil & Gas','Banking & Finance','Telecoms',
  'FMCG','Construction','Healthcare','Agriculture','Technology','Logistics',
  'Real Estate','Education','Other',
];

export function EditClientModal({ client, onClose }: Props) {
  const updateClient = useUpdateClient();

  const [form, setForm] = useState({
    name: '', email: '', phone: '', sector: '',
    companyRegistration: '', creditLimit: '', slaDays: '30', notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-populate when client changes
  useEffect(() => {
    if (client) {
      setForm({
        name:                client.name                ?? '',
        email:               client.email               ?? '',
        phone:               client.phone               ?? '',
        sector:              client.sector              ?? '',
        companyRegistration: client.companyRegistration ?? '',
        creditLimit:         String(client.creditLimit  ?? ''),
        slaDays:             String(client.slaDays      ?? 30),
        notes:               client.notes               ?? '',
      });
      setErrors({});
    }
  }, [client]);

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }));
    if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim())                                           e.name        = 'Name is required';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))          e.email       = 'Invalid email';
    if (!form.creditLimit || Number(form.creditLimit) <= 0)         e.creditLimit = 'Enter a valid credit limit';
    if (!form.slaDays || Number(form.slaDays) < 1 || Number(form.slaDays) > 365)
                                                                     e.slaDays     = 'SLA must be 1–365 days';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSave() {
    if (!validate() || !client) return;
    try {
      await updateClient.mutateAsync({
        id:   client.id,
        data: {
          name:                form.name.trim(),
          email:               form.email               || undefined,
          phone:               form.phone               || undefined,
          sector:              form.sector              || undefined,
          companyRegistration: form.companyRegistration || undefined,
          creditLimit:         parseFloat(form.creditLimit),
          slaDays:             parseInt(form.slaDays, 10),
          notes:               form.notes               || undefined,
        },
      });
      onClose();
    } catch { /* handled by mutation */ }
  }

  if (!client) return null;

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
              <Building2 size={15} style={{ color: 'var(--indigo-2)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Edit Client</h2>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{client.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70" style={{ background: 'var(--bg-3)' }}>
            <X size={14} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="form-label">Company Name *</label>
            <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} />
            {errors.name && <p className="form-error">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input className="form-input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="form-label">Sector</label>
            <select className="form-input" value={form.sector} onChange={e => set('sector', e.target.value)}>
              <option value="">Select sector…</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Company Registration Number</label>
            <input className="form-input mono" value={form.companyRegistration} onChange={e => set('companyRegistration', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Credit Limit (₦) *</label>
              <input className="form-input mono" type="number" min="0" value={form.creditLimit} onChange={e => set('creditLimit', e.target.value)} />
              {errors.creditLimit && <p className="form-error">{errors.creditLimit}</p>}
            </div>
            <div>
              <label className="form-label">SLA Days *</label>
              <input className="form-input mono" type="number" min="1" max="365" value={form.slaDays} onChange={e => set('slaDays', e.target.value)} />
              {errors.slaDays && <p className="form-error">{errors.slaDays}</p>}
            </div>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input resize-none" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 sticky bottom-0" style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <AmberButton onClick={handleSave} disabled={updateClient.isPending}>
            {updateClient.isPending ? 'Saving…' : 'Save Changes'}
          </AmberButton>
        </div>
      </div>
    </div>
  );
}