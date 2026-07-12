'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Users, DollarSign, Download, Filter, RefreshCw } from 'lucide-react';
import { reportsApi } from '@/lib/api/client';
import { fmtCurrency, fmtDate } from '@/lib/utils';
import { SkeletonTable } from '@/components/ui';
import { useAuthStore } from '@/lib/store/auth.store';

type ReportType = 'invoices' | 'collections' | 'clients';

const REPORT_TABS: { id: ReportType; label: string; icon: React.ElementType }[] = [
  { id: 'invoices',    label: 'Invoices',    icon: FileText    },
  { id: 'collections', label: 'Collections', icon: DollarSign  },
  { id: 'clients',     label: 'Clients',     icon: Users       },
];

const STATUS_OPTIONS = ['', 'PENDING', 'DUE_TODAY', 'OVERDUE', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];

function downloadCsv(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape  = (v: any) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { user } = useAuthStore();
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

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['reports', type, applied],
    queryFn:  fetcher,
  });

  const applyFilters = () => setApplied({ from, to, status });

  // ── Column definitions ────────────────────────────────────────────────────
  const cols: Record<ReportType, { key: string; label: string; fmt?: (v: any, row: any) => string }[]> = {
    invoices: [
      { key: 'invoiceNumber', label: 'Invoice #' },
      { key: 'client',        label: 'Client' },
      { key: 'amount',        label: 'Amount',   fmt: (v, r) => fmtCurrency(v, r.currency) },
      { key: 'amountPaid',    label: 'Paid',     fmt: (v, r) => fmtCurrency(v, r.currency) },
      { key: 'remaining',     label: 'Balance',  fmt: (v, r) => fmtCurrency(v, r.currency) },
      { key: 'status',        label: 'Status' },
      { key: 'invoiceDate',   label: 'Date' },
      { key: 'dueDate',       label: 'Due' },
    ],
    collections: [
      { key: 'invoiceNumber', label: 'Invoice #' },
      { key: 'client',        label: 'Client' },
      { key: 'amount',        label: 'Amount',      fmt: (v, r) => fmtCurrency(v, r.currency) },
      { key: 'paymentDate',   label: 'Date' },
      { key: 'recordedBy',    label: 'Recorded By' },
      { key: 'notes',         label: 'Notes' },
    ],
    clients: [
      { key: 'name',         label: 'Client' },
      { key: 'sector',       label: 'Sector' },
      { key: 'pdi',          label: 'PDI',         fmt: v => `${Number(v).toFixed(1)}` },
      { key: 'risk',         label: 'Risk' },
      { key: 'creditLimit',  label: 'Credit Limit', fmt: v => fmtCurrency(v) },
      { key: 'invoiceCount', label: 'Invoices' },
      { key: 'violations',   label: 'SLA Violations' },
      { key: 'isBlocked',    label: 'Blocked',     fmt: v => (v ? 'Yes' : 'No') },
    ],
  };

  const columns = cols[type];

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Report type tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {REPORT_TABS.map(t => (
            <button key={t.id} onClick={() => setType(t.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: type === t.id ? 'var(--bg-3)' : 'transparent',
                color:      type === t.id ? 'var(--indigo-2)' : 'var(--text-3)',
                border:     `1px solid ${type === t.id ? 'var(--border-2)' : 'transparent'}`,
              }}
            >
              <t.icon size={13} />{t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-xs" style={{ color: 'var(--text-3)' }}>{data.length} records</span>
        <button
          onClick={() => downloadCsv(data, `${type}-report.csv`)}
          disabled={!data.length}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-40"
          style={{ background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
        >
          <Download size={12} />Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={13} style={{ color: 'var(--text-3)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>FILTERS</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="form-label">From date</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">To date</label>
            <input type="date" value={to}   onChange={e => setTo(e.target.value)}   className="form-input" />
          </div>
          {type === 'invoices' && (
            <div>
              <label className="form-label">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="form-input">
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s || 'All statuses'}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              onClick={applyFilters}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90 flex-1"
              style={{ background: 'var(--indigo)', color: '#fff' }}
            >
              <RefreshCw size={11} />Apply
            </button>
            <button
              onClick={() => { setFrom(''); setTo(''); setStatus(''); setApplied({ from: '', to: '', status: '' }); }}
              className="px-3 py-2 rounded-lg text-xs transition-all hover:opacity-70"
              style={{ background: 'var(--bg-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Data table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <SkeletonTable rows={8} />
          ) : !data.length ? (
            <div className="py-16 text-center">
              <FileText size={32} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-3)' }} />
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>No records match the selected filters</p>
            </div>
          ) : (
            <table className="w-full text-xs" style={{ minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {columns.map(c => (
                    <th key={c.key} className="text-left px-4 py-3 font-medium text-[10px] uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-3)' }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row: any, i: number) => (
                  <tr key={row.id ?? i} className="border-b hover:opacity-80 transition-all" style={{ borderColor: 'var(--border)' }}>
                    {columns.map(c => (
                      <td key={c.key} className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                        {c.fmt ? c.fmt(row[c.key], row) : (row[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary row */}
        {!!data.length && type === 'invoices' && (
          <div className="px-4 py-3 flex items-center gap-6 flex-wrap" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              Total invoiced: <strong style={{ color: 'var(--text)' }}>{fmtCurrency(data.reduce((s: number, r: any) => s + r.amount, 0))}</strong>
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              Total collected: <strong style={{ color: 'var(--green)' }}>{fmtCurrency(data.reduce((s: number, r: any) => s + r.amountPaid, 0))}</strong>
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              Outstanding: <strong style={{ color: 'var(--red)' }}>{fmtCurrency(data.reduce((s: number, r: any) => s + r.remaining, 0))}</strong>
            </span>
          </div>
        )}
        {!!data.length && type === 'collections' && (
          <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              Total collected: <strong style={{ color: 'var(--green)' }}>{fmtCurrency(data.reduce((s: number, r: any) => s + r.amount, 0))}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
