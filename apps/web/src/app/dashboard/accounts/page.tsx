'use client';

import { useState } from 'react';
import { Plus, Landmark, AlertTriangle } from 'lucide-react';
import {
  useAccounts, useAccountAction, useReplenishments, useReplenishmentAction,
} from '@/lib/hooks/usePaymentControl';
import {
  PageHeader, Button, ResponsiveTable, Column, EmptyState, StatusPill, Dialog, Field, SkeletonCard, SectionTitle, Pagination,
} from '@/components/ui';

const PAGE_SIZE = 20;
import { fmtCurrency } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';

interface Account { id: string; name: string; bankName: string; accountNumber: string; currency: string; currentBalance: number; minimumBalance: number; belowMinimum: boolean; isActive: boolean; }
interface Replenishment { id: string; reference: string; requiredAmount: number; requestedAmount: number; approvedAmount?: number | null; status: string; operationalAccount?: { name: string; currency: string }; }

export default function AccountsPage() {
  const { user } = useAuthStore();
  const canManage = user?.role === 'ADMIN' || user?.role === 'CFO';

  const [rplPage, setRplPage] = useState(1);
  const { data: accData, isLoading: accLoading } = useAccounts({ limit: 200 });
  const accounts: Account[] = accData?.data ?? [];
  const { data: rplData, isLoading: rplLoading } = useReplenishments({ page: rplPage, limit: PAGE_SIZE });
  const replenishments: Replenishment[] = rplData?.data ?? [];
  const rplMeta = rplData?.meta;
  const accAction = useAccountAction();
  const rplAction = useReplenishmentAction();

  const [accOpen, setAccOpen] = useState(false);
  const [editAcc, setEditAcc] = useState<Account | null>(null);
  const [accForm, setAccForm] = useState<any>({ name: '', accountNumber: '', bankName: '', currency: 'NGN', currentBalance: '', minimumBalance: '' });
  const [rplOpen, setRplOpen] = useState(false);
  const [rplForm, setRplForm] = useState<any>({ operationalAccountId: '', requestedAmount: '', notes: '' });
  const [err, setErr] = useState('');

  const openNewAcc = () => { setEditAcc(null); setAccForm({ name: '', accountNumber: '', bankName: '', currency: 'NGN', currentBalance: '', minimumBalance: '' }); setErr(''); setAccOpen(true); };
  const openEditAcc = (a: Account) => { setEditAcc(a); setAccForm({ name: a.name, minimumBalance: a.minimumBalance, isActive: a.isActive }); setErr(''); setAccOpen(true); };

  const saveAcc = async () => {
    if (!accForm.name?.trim()) { setErr('Name is required'); return; }
    try {
      if (editAcc) {
        await accAction.mutateAsync({ action: 'update', id: editAcc.id, payload: { name: accForm.name, minimumBalance: Number(accForm.minimumBalance) || 0, isActive: accForm.isActive } });
      } else {
        if (!accForm.accountNumber || !accForm.bankName) { setErr('Account number and bank are required'); return; }
        await accAction.mutateAsync({ action: 'create', payload: {
          name: accForm.name, accountNumber: accForm.accountNumber, bankName: accForm.bankName, currency: accForm.currency,
          currentBalance: Number(accForm.currentBalance) || 0, minimumBalance: Number(accForm.minimumBalance) || 0,
        } });
      }
      setAccOpen(false);
    } catch { /* toast */ }
  };

  const saveRpl = async () => {
    if (!rplForm.operationalAccountId) { setErr('Select an account'); return; }
    if (!rplForm.requestedAmount || Number(rplForm.requestedAmount) <= 0) { setErr('Enter a valid amount'); return; }
    try {
      await rplAction.mutateAsync({ action: 'create', payload: { operationalAccountId: rplForm.operationalAccountId, requestedAmount: Number(rplForm.requestedAmount), notes: rplForm.notes || undefined } });
      setRplOpen(false);
    } catch { /* toast */ }
  };

  const rplCols: Column<Replenishment>[] = [
    { key: 'reference', header: 'Reference', primary: true, render: r => <span className="mono">{r.reference}</span> },
    { key: 'account', header: 'Account', render: r => r.operationalAccount?.name ?? '—' },
    { key: 'requestedAmount', header: 'Requested', align: 'right', render: r => fmtCurrency(r.requestedAmount, r.operationalAccount?.currency) },
    { key: 'approvedAmount', header: 'Approved', align: 'right', render: r => r.approvedAmount != null ? fmtCurrency(r.approvedAmount, r.operationalAccount?.currency) : '—' },
    { key: 'status', header: 'Status', render: r => <StatusPill label={r.status} tone={r.status === 'FUNDED' ? 'green' : r.status === 'APPROVED' ? 'blue' : r.status === 'DECLINED' ? 'red' : 'amber'} /> },
  ];

  const rplActions = (r: Replenishment) => {
    if (!canManage) return null;
    if (r.status === 'PENDING') return (
      <div className="flex gap-1.5 justify-end">
        <button className="chip" style={{ minHeight: 32 }} onClick={() => rplAction.mutate({ action: 'approve', id: r.id })}>Approve</button>
        <button className="chip" style={{ minHeight: 32, color: 'var(--red)' }} onClick={() => rplAction.mutate({ action: 'decline', id: r.id })}>Decline</button>
      </div>
    );
    if (r.status === 'APPROVED') return (
      <button className="chip" style={{ minHeight: 32, color: 'var(--green)' }} onClick={() => rplAction.mutate({ action: 'fund', id: r.id })}>Fund</button>
    );
    return null;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Operational Accounts" subtitle="Disbursement accounts and funding"
        actions={canManage ? <Button onClick={openNewAcc} blockMobile><Plus size={15} /> New Account</Button> : undefined} />

      {/* Account balance cards */}
      {accLoading ? (
        <div className="stat-grid">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : accounts.length === 0 ? (
        <div className="card"><EmptyState icon={<Landmark size={30} />} title="No operational accounts" sub="Create one to disburse supplier payments" /></div>
      ) : (
        <div className="stat-grid stat-grid--3">
          {accounts.map(a => (
            <button key={a.id} onClick={() => canManage && openEditAcc(a)} className="card p-4 text-left transition-all" style={{ cursor: canManage ? 'pointer' : 'default' }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-2)' }}>{a.name}</span>
                {a.belowMinimum && <StatusPill label="Low" tone="red" />}
              </div>
              <p className="mono text-xl font-bold leading-none" style={{ color: a.belowMinimum ? 'var(--red)' : 'var(--text)' }}>{fmtCurrency(a.currentBalance, a.currency)}</p>
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-3)' }}>{a.bankName} · {a.accountNumber}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Min {fmtCurrency(a.minimumBalance, a.currency)}</p>
            </button>
          ))}
        </div>
      )}

      {/* Replenishments */}
      <div>
        <SectionTitle title="Replenishments" action={<Button variant="ghost" onClick={() => { setRplForm({ operationalAccountId: accounts[0]?.id ?? '', requestedAmount: '', notes: '' }); setErr(''); setRplOpen(true); }}><Plus size={14} /> Request</Button>} />
        <ResponsiveTable columns={rplCols} rows={replenishments} loading={rplLoading} rowActions={rplActions}
          empty={<div className="card"><EmptyState icon={<AlertTriangle size={28} />} title="No replenishment requests" /></div>} />
        {rplMeta && <Pagination page={rplPage} totalPages={rplMeta.totalPages} total={rplMeta.total} pageSize={PAGE_SIZE} onPage={setRplPage} label="replenishments" />}
      </div>

      {/* Account dialog */}
      <Dialog open={accOpen} onClose={() => setAccOpen(false)} icon={<Landmark size={15} />}
        title={editAcc ? 'Edit account' : 'New operational account'} subtitle={editAcc?.name}
        footer={<><Button variant="ghost" onClick={() => setAccOpen(false)}>Cancel</Button><Button onClick={saveAcc} disabled={accAction.isPending}>{accAction.isPending ? 'Saving…' : 'Save'}</Button></>}>
        <Field label="Account name" error={err}><input className="form-input" value={accForm.name} onChange={e => setAccForm({ ...accForm, name: e.target.value })} placeholder="Main Disbursement Account" /></Field>
        {!editAcc && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
              <Field label="Bank"><input className="form-input" value={accForm.bankName} onChange={e => setAccForm({ ...accForm, bankName: e.target.value })} /></Field>
              <Field label="Account number"><input className="form-input mono" value={accForm.accountNumber} onChange={e => setAccForm({ ...accForm, accountNumber: e.target.value })} /></Field>
            </div>
            <Field label="Opening balance"><input className="form-input mono" type="number" value={accForm.currentBalance} onChange={e => setAccForm({ ...accForm, currentBalance: e.target.value })} placeholder="0.00" /></Field>
          </>
        )}
        <Field label="Minimum balance (replenishment threshold)"><input className="form-input mono" type="number" value={accForm.minimumBalance} onChange={e => setAccForm({ ...accForm, minimumBalance: e.target.value })} placeholder="0.00" /></Field>
        {editAcc && <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}><input type="checkbox" checked={accForm.isActive} onChange={e => setAccForm({ ...accForm, isActive: e.target.checked })} /> Active</label>}
      </Dialog>

      {/* Replenishment dialog */}
      <Dialog open={rplOpen} onClose={() => setRplOpen(false)} icon={<Plus size={15} />} title="Request replenishment"
        footer={<><Button variant="ghost" onClick={() => setRplOpen(false)}>Cancel</Button><Button onClick={saveRpl} disabled={rplAction.isPending}>{rplAction.isPending ? 'Submitting…' : 'Submit'}</Button></>}>
        <Field label="Account" error={err}>
          <select className="form-input" value={rplForm.operationalAccountId} onChange={e => setRplForm({ ...rplForm, operationalAccountId: e.target.value })}>
            <option value="">Select account…</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {fmtCurrency(a.currentBalance, a.currency)}</option>)}
          </select>
        </Field>
        <Field label="Requested amount"><input className="form-input mono" type="number" value={rplForm.requestedAmount} onChange={e => setRplForm({ ...rplForm, requestedAmount: e.target.value })} placeholder="0.00" /></Field>
        <Field label="Notes"><textarea className="form-input" rows={2} value={rplForm.notes} onChange={e => setRplForm({ ...rplForm, notes: e.target.value })} /></Field>
      </Dialog>
    </div>
  );
}
