'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Users, DollarSign, Download, Filter, RefreshCw } from 'lucide-react';
import { reportsApi } from '@/lib/api/client';
import { fmtCurrency } from '@/lib/utils';
import { PageHeader, Toolbar, Button, GhostButton, ResponsiveTable, Column, EmptyState } from '@/components/ui';

type ReportType = 'invoices' | 'collections' | 'clients';

const REPORT_TABS: { id: ReportType; label: string; icon: React.ElementType }[] = [
  { id: 'invoices',    label: 'Invoices',    icon: FileText   },
  { id: 'collections', label: 'Collections', icon: DollarSign },
  { id: 'clients',     label: 'Clients',     icon: Users      },
];

const STATUS_OPTIONS = ['', 'PENDING', 'DUE_TODAY', 'OVERDUE', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];

function downloadCsv(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape  = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [type,   setType]   = useState<ReportType>('invoices');
  const [from,   setFrom]   = useState('');
  const [to,     setTo]     = useState('');
  const [status, setStatus] = useState('');
  const [applied, setApplied] = useState({ from: '', to: '', status: '' });

  const params = { ...(applied.from && { from: applied.from }), ...(applied.to && { to: applied.to }), ...(applied.status && { status: applied.status }) };

  const fetcher = type === 'invoices'
    ? () => reportsApi.invoices(params).then(r => r.data?.data ?? [])
    : type === 'collections'
    ? () => reportsApi.collections(params).then(r => r.data?.data ?? [])
    : () => reportsApi.clients(params).then(r => r.data?.data ?? []);

  const { data = [], isLoading } = useQuery({ queryKey: ['reports', type, applied], queryFn: fetcher });
  const applyFilters = () => setApplied({ from, to, status });

  const colDefs: Record<ReportType, { key: string; label: string; fmt?: (v: any, row: any) => string }[]> = {
    invoices: [
      { key: 'invoiceNumber', label: 'Invoice #' },
      { key: 'client',        label: 'Client' },
      { key: 'amount',        label: 'Amount',  fmt: (v, r) => fmtCurrency(v, r.currency) },
      { key: 'amountPaid',    label: 'Paid',    fmt: (v, r) => fmtCurrency(v, r.currency) },
      { key: 'remaining',     label: 'Balance', fmt: (v, r) => fmtCurrency(v, r.currency) },
      { key: 'status',        label: 'Status' },
      { key: 'invoiceDate',   label: 'Date' },
      { key: 'dueDate',       label: 'Due' },
    ],
    collections: [
      { key: 'invoiceNumber', label: 'Invoice #' },
      { key: 'client',        label: 'Client' },
      { key: 'amount',        label: 'Amount', fmt: (v, r) => fmtCurrency(v, r.currency) },
      { key: 'paymentDate',   label: 'Date' },
      { key: 'recordedBy',    label: 'Recorded By' },
      { key: 'notes',         label: 'Notes' },
    ],
    clients: [
      { key: 'name',         label: 'Client' },
      { key: 'sector',       label: 'Sector' },
      { key: 'pdi',          label: 'PDI',          fmt: v => `${Number(v).toFixed(1)}` },
      { key: 'risk',         label: 'Risk' },
      { key: 'creditLimit',  label: 'Credit Limit', fmt: v => fmtCurrency(v) },
      { key: 'invoiceCount', label: 'Invoices' },
      { key: 'violations',   label: 'SLA Violations' },
      { key: 'isBlocked',    label: 'Blocked',      fmt: v => (v ? 'Yes' : 'No') },
    ],
  };

  const columns: Column<any>[] = colDefs[type].map((c, i) => ({
    key: c.key, header: c.label, primary: i === 0,
    align: ['amount', 'amountPaid', 'remaining', 'creditLimit', 'pdi', 'invoiceCount', 'violations'].includes(c.key) ? 'right' : 'left',
    render: (row: any) => (c.fmt ? c.fmt(row[c.key], row) : (row[c.key] ?? '—')),
  }));

  const totals = type === 'invoices' ? {
    invoiced: data.reduce((s: number, r: any) => s + r.amount, 0),
    collected: data.reduce((s: number, r: any) => s + r.amountPaid, 0),
    outstanding: data.reduce((s: number, r: any) => s + r.remaining, 0),
  } : type === 'collections' ? { collected: data.reduce((s: number, r: any) => s + r.amount, 0) } : null;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Reports" subtitle="Export receivables, collections and client data"
        actions={<Button onClick={() => downloadCsv(data, `${type}-report.csv`)} disabled={!data.length} blockMobile><Download size={14} /> Export CSV</Button>} />

      {/* Report type tabs */}
      <Toolbar className="mb-3">
        <div className="segmented">
          {REPORT_TABS.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} className="chip" data-active={type === t.id}>
              <t.icon size={13} />{t.label}
            </button>
          ))}
        </div>
        <div className="hidden sm:block flex-1" />
        <span className="text-xs" style={{ color: 'var(--text-3)' }}>{data.length} records</span>
      </Toolbar>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3"><Filter size={13} style={{ color: 'var(--text-3)' }} /><span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>FILTERS</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div><label className="form-label">From date</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="form-input" /></div>
          <div><label className="form-label">To date</label><input type="date" value={to} onChange={e => setTo(e.target.value)} className="form-input" /></div>
          {type === 'invoices' && (
            <div><label className="form-label">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="form-input">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters} block><RefreshCw size={13} /> Apply</Button>
            <GhostButton onClick={() => { setFrom(''); setTo(''); setStatus(''); setApplied({ from: '', to: '', status: '' }); }}>Clear</GhostButton>
          </div>
        </div>
      </div>

      {/* Data */}
      <ResponsiveTable columns={columns} rows={data} loading={isLoading}
        empty={<div className="card"><EmptyState icon={<FileText size={32} />} title="No records" sub="No records match the selected filters" /></div>} />

      {/* Summary */}
      {!!data.length && totals && (
        <div className="card mt-3 px-4 py-3 flex items-center gap-x-6 gap-y-1 flex-wrap" style={{ background: 'var(--bg-2)' }}>
          {'invoiced' in totals && <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>Invoiced: <strong style={{ color: 'var(--text)' }}>{fmtCurrency(totals.invoiced)}</strong></span>}
          {'collected' in totals && <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>Collected: <strong style={{ color: 'var(--green)' }}>{fmtCurrency(totals.collected)}</strong></span>}
          {'outstanding' in totals && <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>Outstanding: <strong style={{ color: 'var(--red)' }}>{fmtCurrency(totals.outstanding)}</strong></span>}
        </div>
      )}
    </div>
  );
}
