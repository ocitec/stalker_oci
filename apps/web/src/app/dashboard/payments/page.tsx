'use client';

import { useState } from 'react';
import { Plus, Banknote, AlertTriangle, CheckCircle2, Wallet } from 'lucide-react';
import {
  usePayments, usePaymentAction, usePaymentDashboard, usePaymentExceptions,
  useSuppliers, useAccounts,
} from '@/lib/hooks/usePaymentControl';
import { useTransactions } from '@/lib/hooks/useControlChain';
import {
  PageHeader, Toolbar, Button, KpiCard, ResponsiveTable, Column, EmptyState,
  StatusPill, Dialog, Field, SkeletonCard, Pagination,
} from '@/components/ui';

const PAGE_SIZE = 20;
import { fmtCurrency } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';

interface PR {
  id: string; reference: string; requestedAmount: number; paymentAmount?: number | null; currency: string;
  status: string; paymentMethod?: string | null; dueDate?: string | null; replenishmentRequired?: boolean;
  supplier?: { name: string }; operationalAccount?: { name: string }; transaction?: { reference: string; srfNumber?: string };
  _count?: { exceptions: number };
}

const STATUSES = ['', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'];
const tone = (s: string): any => ({ PAID: 'green', APPROVED: 'blue', PROCESSING: 'blue', PENDING_APPROVAL: 'amber', FAILED: 'red', DRAFT: 'neutral', CANCELLED: 'neutral' }[s] ?? 'neutral');
const label = (s: string) => s.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const canApprove = user?.role === 'ADMIN' || user?.role === 'CFO';

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data: dash, isLoading: dashLoading } = usePaymentDashboard();
  const { data, isLoading } = usePayments({ status: status || undefined, page, limit: PAGE_SIZE });
  const payments: PR[] = data?.data ?? [];
  const meta = data?.meta;
  const { data: exceptions = [] } = usePaymentExceptions('OPEN');
  const action = usePaymentAction();

  // create form data
  const { data: txnData } = useTransactions({ status: 'APPROVED', limit: 100 });
  const approvedTxns = txnData?.data ?? [];
  const { data: supData } = useSuppliers({ isActive: true, limit: 200 });
  const suppliers = supData?.data ?? [];
  const { data: accData } = useAccounts({ isActive: true, limit: 200 });
  const accounts = accData?.data ?? [];

  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState<any>({ transactionId: '', supplierId: '', operationalAccountId: '', requestedAmount: '', dueDate: '' });
  const [err, setErr] = useState('');
  const [proc, setProc] = useState<PR | null>(null);
  const [procForm, setProcForm] = useState<any>({ paymentMethod: 'BANK_TRANSFER', paymentAmount: '', confirmationReference: '' });
  const [confirmPr, setConfirmPr] = useState<PR | null>(null);
  const [confRef, setConfRef] = useState('');

  const p = dash?.pendingPayments ?? { dueToday: 0, overdue: 0, awaitingConfirmation: 0, failed: 0 };

  const openNew = () => { setForm({ transactionId: '', supplierId: '', operationalAccountId: accounts[0]?.id ?? '', requestedAmount: '', dueDate: '' }); setErr(''); setNewOpen(true); };
  const onPickTxn = (id: string) => {
    const t = approvedTxns.find((x: any) => x.id === id);
    setForm((f: any) => ({ ...f, transactionId: id, requestedAmount: t ? String(t.supplierCost ?? '') : f.requestedAmount }));
  };
  const createPr = async () => {
    if (!form.transactionId || !form.supplierId || !form.operationalAccountId) { setErr('Transaction, supplier and account are required'); return; }
    try {
      await action.mutateAsync({ action: 'create', payload: {
        transactionId: form.transactionId, supplierId: form.supplierId, operationalAccountId: form.operationalAccountId,
        requestedAmount: form.requestedAmount ? Number(form.requestedAmount) : undefined,
        dueDate: form.dueDate || undefined,
      } });
      setNewOpen(false);
    } catch { /* toast */ }
  };
  const doProcess = async () => {
    if (!proc) return;
    try {
      await action.mutateAsync({ action: 'process', id: proc.id, payload: {
        paymentMethod: procForm.paymentMethod,
        paymentAmount: procForm.paymentAmount ? Number(procForm.paymentAmount) : undefined,
        confirmationReference: procForm.confirmationReference || undefined,
      } });
      setProc(null);
    } catch { /* toast */ }
  };
  const doConfirm = async () => {
    if (!confirmPr || !confRef.trim()) return;
    try { await action.mutateAsync({ action: 'confirm', id: confirmPr.id, payload: { confirmationReference: confRef } }); setConfirmPr(null); setConfRef(''); } catch { /* toast */ }
  };

  const columns: Column<PR>[] = [
    { key: 'reference', header: 'Reference', primary: true, render: r => (
      <div><div className="mono text-[11px]" style={{ color: 'var(--text)' }}>{r.reference}</div>
        <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{r.transaction?.srfNumber ?? r.transaction?.reference}</div></div>
    ) },
    { key: 'supplier', header: 'Supplier', render: r => r.supplier?.name ?? '—' },
    { key: 'requestedAmount', header: 'Amount', align: 'right', render: r => fmtCurrency(r.paymentAmount ?? r.requestedAmount, r.currency) },
    { key: 'account', header: 'Account', hideOnMobile: true, render: r => r.operationalAccount?.name ?? '—' },
    { key: 'status', header: 'Status', render: r => (
      <span className="inline-flex items-center gap-1">
        <StatusPill label={label(r.status)} tone={tone(r.status)} />
        {r.replenishmentRequired && <StatusPill label="Fund" tone="red" />}
      </span>
    ) },
  ];

  const rowActions = (r: PR) => {
    const acts: React.ReactNode[] = [];
    const chip = (lbl: string, fn: () => void, color?: string) => (
      <button key={lbl} className="chip" style={{ minHeight: 32, ...(color ? { color } : {}) }} onClick={fn}>{lbl}</button>
    );
    if (r.status === 'DRAFT') acts.push(chip('Submit', () => action.mutate({ action: 'submit', id: r.id })));
    if (r.status === 'PENDING_APPROVAL' && canApprove) acts.push(chip('Approve', () => action.mutate({ action: 'approve', id: r.id }), 'var(--green)'));
    if (r.status === 'APPROVED') acts.push(chip('Process', () => { setProc(r); setProcForm({ paymentMethod: 'BANK_TRANSFER', paymentAmount: '', confirmationReference: '' }); }));
    if (r.status === 'PROCESSING') { acts.push(chip('Confirm', () => { setConfirmPr(r); setConfRef(''); }, 'var(--green)')); acts.push(chip('Fail', () => action.mutate({ action: 'fail', id: r.id }), 'var(--red)')); }
    if (['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(r.status)) acts.push(chip('Cancel', () => action.mutate({ action: 'cancel', id: r.id }), 'var(--text-3)'));
    return acts.length ? <div className="flex gap-1.5 justify-end flex-wrap">{acts}</div> : null;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Payment Control" subtitle="Supplier disbursements, approvals and confirmations"
        actions={<Button onClick={openNew} blockMobile><Plus size={15} /> New Payment</Button>} />

      {/* KPIs */}
      {dashLoading ? (
        <div className="stat-grid">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : (
        <div className="stat-grid">
          <KpiCard label="Due Today" value={p.dueToday} accent="var(--amber)" />
          <KpiCard label="Overdue" value={p.overdue} accent={p.overdue ? 'var(--red)' : undefined} />
          <KpiCard label="Awaiting Confirmation" value={p.awaitingConfirmation} accent="var(--indigo-2)" />
          <KpiCard label="Pending Disbursement" value={fmtCurrency(dash?.totalPendingDisbursement ?? 0)} />
        </div>
      )}

      {/* Account balances + exceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3"><Wallet size={14} style={{ color: 'var(--text-3)' }} /><span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>ACCOUNT BALANCES</span></div>
          <div className="space-y-2">
            {(dash?.accountBalances ?? []).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-3">
                <span className="text-xs truncate" style={{ color: 'var(--text-2)' }}>{a.name}</span>
                <span className="mono text-xs font-bold" style={{ color: a.belowMinimum ? 'var(--red)' : 'var(--text)' }}>{fmtCurrency(a.currentBalance, a.currency)}</span>
              </div>
            ))}
            {!dash?.accountBalances?.length && <p className="text-xs" style={{ color: 'var(--text-3)' }}>No accounts yet.</p>}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3"><AlertTriangle size={14} style={{ color: 'var(--red)' }} /><span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>OPEN EXCEPTIONS ({exceptions.length})</span></div>
          <div className="space-y-2">
            {exceptions.slice(0, 5).map((e: any) => (
              <div key={e.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0"><p className="text-xs font-medium truncate" style={{ color: 'var(--text-2)' }}>{label(e.type)}</p><p className="text-[10px] truncate" style={{ color: 'var(--text-3)' }}>{e.paymentRequest?.reference}</p></div>
                <button className="chip" style={{ minHeight: 30 }} onClick={() => action.mutate({ action: 'resolveException', id: e.id })}>Resolve</button>
              </div>
            ))}
            {!exceptions.length && <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--green)' }}><CheckCircle2 size={14} /> No open exceptions</div>}
          </div>
        </div>
      </div>

      {/* Payment requests */}
      <div>
        <Toolbar className="mb-3">
          <div className="segmented">
            {STATUSES.map(s => (
              <button key={s} className="chip" data-active={status === s} onClick={() => { setStatus(s); setPage(1); }}>{s ? label(s) : 'All'}</button>
            ))}
          </div>
        </Toolbar>
        <ResponsiveTable columns={columns} rows={payments} loading={isLoading} rowActions={rowActions}
          empty={<div className="card"><EmptyState icon={<Banknote size={30} />} title="No payment requests" sub="Raise one from an approved transaction" action={<Button onClick={openNew}><Plus size={15} /> New Payment</Button>} /></div>} />
        {meta && <Pagination page={page} totalPages={meta.totalPages} total={meta.total} pageSize={PAGE_SIZE} onPage={setPage} label="payments" />}
      </div>

      {/* New payment request dialog */}
      <Dialog open={newOpen} onClose={() => setNewOpen(false)} icon={<Banknote size={15} />} title="New payment request" subtitle="Disburse against an approved transaction"
        footer={<><Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button><Button onClick={createPr} disabled={action.isPending}>{action.isPending ? 'Creating…' : 'Create'}</Button></>}>
        <Field label="Approved transaction" error={err}>
          <select className="form-input" value={form.transactionId} onChange={e => onPickTxn(e.target.value)}>
            <option value="">Select transaction…</option>
            {approvedTxns.map((t: any) => <option key={t.id} value={t.id}>{t.reference} — {fmtCurrency(t.newTransactionValue)} (cost {fmtCurrency(t.supplierCost)})</option>)}
          </select>
        </Field>
        <Field label="Supplier">
          <select className="form-input" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}>
            <option value="">Select supplier…</option>
            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Operational account">
          <select className="form-input" value={form.operationalAccountId} onChange={e => setForm({ ...form, operationalAccountId: e.target.value })}>
            <option value="">Select account…</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name} — {fmtCurrency(a.currentBalance, a.currency)}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <Field label="Amount" hint="Defaults to supplier cost"><input className="form-input mono" type="number" value={form.requestedAmount} onChange={e => setForm({ ...form, requestedAmount: e.target.value })} placeholder="0.00" /></Field>
          <Field label="Due date"><input className="form-input" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></Field>
        </div>
      </Dialog>

      {/* Process dialog */}
      <Dialog open={!!proc} onClose={() => setProc(null)} icon={<Banknote size={15} />} title="Process payment" subtitle={proc?.reference}
        footer={<><Button variant="ghost" onClick={() => setProc(null)}>Cancel</Button><Button onClick={doProcess} disabled={action.isPending}>{action.isPending ? 'Processing…' : 'Disburse'}</Button></>}>
        <Field label="Payment method">
          <select className="form-input" value={procForm.paymentMethod} onChange={e => setProcForm({ ...procForm, paymentMethod: e.target.value })}>
            {['BANK_TRANSFER', 'CHEQUE', 'CASH', 'CARD', 'MOBILE_MONEY', 'OTHER'].map(m => <option key={m} value={m}>{label(m)}</option>)}
          </select>
        </Field>
        <Field label="Amount" hint="Defaults to requested amount"><input className="form-input mono" type="number" value={procForm.paymentAmount} onChange={e => setProcForm({ ...procForm, paymentAmount: e.target.value })} placeholder={proc ? String(proc.requestedAmount) : '0.00'} /></Field>
        <Field label="Reference"><input className="form-input" value={procForm.confirmationReference} onChange={e => setProcForm({ ...procForm, confirmationReference: e.target.value })} placeholder="Bank transfer ref" /></Field>
      </Dialog>

      {/* Confirm dialog */}
      <Dialog open={!!confirmPr} onClose={() => setConfirmPr(null)} icon={<CheckCircle2 size={15} />} title="Confirm payment" subtitle={confirmPr?.reference}
        footer={<><Button variant="ghost" onClick={() => setConfirmPr(null)}>Cancel</Button><Button variant="success" onClick={doConfirm} disabled={action.isPending || !confRef.trim()}>{action.isPending ? 'Confirming…' : 'Confirm'}</Button></>}>
        <Field label="Confirmation reference"><input className="form-input" value={confRef} onChange={e => setConfRef(e.target.value)} placeholder="Cleared payment reference" /></Field>
      </Dialog>
    </div>
  );
}
