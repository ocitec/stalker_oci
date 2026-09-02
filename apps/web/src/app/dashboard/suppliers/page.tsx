'use client';

import { useState } from 'react';
import { Search, Plus, Package } from 'lucide-react';
import { useSuppliers, useSupplierAction } from '@/lib/hooks/usePaymentControl';
import {
  PageHeader, Toolbar, Button, ResponsiveTable, Column, EmptyState, StatusPill, Dialog, Field, Pagination, AmberButton, GhostButton,
} from '@/components/ui';

const PAGE_SIZE = 20;

interface Supplier {
  id: string; name: string; code?: string; email?: string; phone?: string;
  bankName?: string; bankAccountNumber?: string; bankAccountName?: string;
  isActive: boolean; _count?: { paymentRequests: number };
}

const EMPTY = { name: '', code: '', email: '', phone: '', bankName: '', bankAccountNumber: '', bankAccountName: '', isActive: true };

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [err, setErr] = useState('');

  const { data, isLoading } = useSuppliers({ search: search || undefined, page, limit: PAGE_SIZE });
  const suppliers: Supplier[] = data?.data ?? [];
  const meta = data?.meta;
  const action = useSupplierAction();

  const startNew = () => { setEditing(null); setForm(EMPTY); setErr(''); setOpen(true); };
  const startEdit = (s: Supplier) => { setEditing(s); setForm({ ...EMPTY, ...s }); setErr(''); setOpen(true); };

  const save = async () => {
    if (!form.name?.trim()) { setErr('Name is required'); return; }
    const payload = {
      name: form.name, code: form.code || undefined, email: form.email || undefined, phone: form.phone || undefined,
      bankName: form.bankName || undefined, bankAccountNumber: form.bankAccountNumber || undefined,
      bankAccountName: form.bankAccountName || undefined,
      ...(editing ? { isActive: form.isActive } : {}),
    };
    try {
      await action.mutateAsync(editing ? { action: 'update', id: editing.id, payload } : { action: 'create', payload });
      setOpen(false);
    } catch { /* toast handles it */ }
  };

  const columns: Column<Supplier>[] = [
    { key: 'name', header: 'Supplier', primary: true, render: s => (
      <div><div className="font-medium" style={{ color: 'var(--text)' }}>{s.name}</div>
        {s.code && <div className="mono text-[10px]" style={{ color: 'var(--text-3)' }}>{s.code}</div>}</div>
    ) },
    { key: 'bankName', header: 'Bank', render: s => s.bankName ? `${s.bankName}${s.bankAccountNumber ? ' · ' + s.bankAccountNumber : ''}` : '—' },
    { key: 'email', header: 'Email', render: s => s.email || '—' },
    { key: 'requests', header: 'Payments', align: 'right', render: s => s._count?.paymentRequests ?? 0 },
    { key: 'isActive', header: 'Status', render: s => <StatusPill label={s.isActive ? 'Active' : 'Inactive'} tone={s.isActive ? 'green' : 'neutral'} /> },
  ];

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader title="Suppliers" subtitle="Disbursement counterparties for payment requests"
          actions={<Button onClick={startNew} blockMobile><Plus size={15} /> New Supplier</Button>} />

        <Toolbar className="mb-4">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Search suppliers…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </Toolbar>

        <ResponsiveTable columns={columns} rows={suppliers} loading={isLoading} onRowClick={startEdit}
          empty={<div className="card"><EmptyState icon={<Package size={30} />} title="No suppliers yet" sub="Add a supplier to start raising payments" action={<Button onClick={startNew}><Plus size={15} /> New Supplier</Button>} /></div>} />

        {meta && <Pagination page={page} totalPages={meta.totalPages} total={meta.total} pageSize={PAGE_SIZE} onPage={setPage} label="suppliers" />}

      </div>
      <Dialog open={open} onClose={() => setOpen(false)} icon={<Package size={15} />}
        title={editing ? 'Edit supplier' : 'New supplier'} subtitle={editing ? editing.name : 'Add a disbursement counterparty'}
        footer={<>
          <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
          <AmberButton onClick={save} disabled={action.isPending}>{action.isPending ? 'Saving…' : 'Save'}</AmberButton>
        </>}>
        <Field label="Name" error={err}><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Acme Supplies Ltd" /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <Field label="Code"><input className="form-input mono" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="SUP-001" /></Field>
          <Field label="Email"><input className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="billing@acme.com" /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <Field label="Bank"><input className="form-input" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} /></Field>
          <Field label="Account Number"><input className="form-input mono" value={form.bankAccountNumber} onChange={e => setForm({ ...form, bankAccountNumber: e.target.value })} /></Field>
        </div>
        <Field label="Phone"><input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
        {editing && (
          <label className="flex items-center gap-2 text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Active
          </label>
        )}
      </Dialog>
    </>
  );
}
