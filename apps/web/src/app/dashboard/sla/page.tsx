'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, Download } from 'lucide-react';
import { useSlaViolations, useTopViolators } from '@/lib/hooks/useApi';
import { SectionTitle, Badge, SkeletonTable, KpiCard, GhostButton, EmptyState } from '@/components/ui';
import { fmtCurrency, fmtDate, getPdiColor } from '@/lib/utils';
import { SlaViolation } from '@/types';

function exportCsv(violations: SlaViolation[]) {
  const header = ['Invoice', 'Client', 'Sector', 'Amount', 'Breach Date', 'Days Late', 'Status'];
  const rows   = violations.map(v => [
    v.invoice?.invoiceNumber  ?? '',
    v.client?.name            ?? '',
    v.client?.sector          ?? '',
    v.invoice?.invoiceAmount  ?? '',
    v.violationDate.split('T')[0],
    v.daysLate,
    v.resolved ? 'RESOLVED' : 'OPEN',
  ]);
  const csv  = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `sla-violations-${new Date().toISOString().split('T')[0]}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 20;

export default function SlaPage() {
  const [page, setPage] = useState(1);
  const { data: violationsData, isLoading } = useSlaViolations({ page, limit: PAGE_SIZE });
  const { data: topViolators }              = useTopViolators();

  const violations     = violationsData?.data ?? [];
  const totalViolations = violationsData?.meta?.total ?? violations.length;
  const unresolved      = violations.filter((v: SlaViolation) => !v.resolved).length;
  const avgDelay        = violations.length
    ? Math.round(violations.reduce((s: number, v: SlaViolation) => s + v.daysLate, 0) / violations.length) : 0;
  const worstDelay      = violations.length ? Math.max(...violations.map((v: SlaViolation) => v.daysLate)) : 0;

  // ── FIX: was (v.name) — must be (v.client?.name ?? '') ──────────────────
  const chartData = (topViolators ?? []).slice(0, 8).map((v: any) => ({
    name:    (v.client?.name ?? '').split(' ').slice(0, 2).join(' '),
    count:   v.violationCount  ?? 0,
    avgDays: v.avgDaysLate     ?? 0,
    color:   getPdiColor(Number(v.client?.paymentDisciplineIndex ?? 50)),
  }));

  return (
    <div className="space-y-5 animate-fade-in">

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total Violations" value={totalViolations}      accent="var(--red)" />
        <KpiCard label="Unresolved"       value={unresolved}           accent="var(--amber)" />
        <KpiCard label="Avg Days Late"    value={`${avgDelay}d`} />
        <KpiCard label="Worst Breach"     value={`${worstDelay}d`}
          accent={worstDelay > 30 ? 'var(--red)' : 'var(--amber)'} />
      </div>

      <div className="grid grid-cols-2 gap-5">

        {/* Chart */}
        <div className="card p-5">
          <SectionTitle title="Top SLA Violators" />
          {chartData.length === 0 ? (
            <EmptyState icon={<AlertTriangle size={28} />} title="No violations recorded" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} layout="vertical" barSize={16}>
                <XAxis type="number" tick={{ fill: '#5A6E96', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#8B9DC3', fontSize: 10 }}
                  axisLine={false} tickLine={false} width={90} />
                <Tooltip
                  contentStyle={{ background: '#1A2236', border: '1px solid #2A3A5C', borderRadius: 8, color: '#E8EDF8', fontSize: 12 }}
                  formatter={(v: any, name: any) => [name === 'count' ? `${v} violations` : `${v}d avg`, name === 'count' ? 'Violations' : 'Avg Delay']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Repeat Offenders */}
        <div className="card p-5">
          <SectionTitle title="Repeat Offenders" />
          <div className="space-y-0">
            {(topViolators ?? []).slice(0, 7).map((v: any, i: number) => {
              const pdi = Number(v.client?.paymentDisciplineIndex ?? 50);
              return (
                <div key={v.clientId ?? i} className="flex items-center gap-3 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="mono text-xs w-5 flex-shrink-0" style={{ color: 'var(--text-3)' }}>#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{v.client?.name ?? '—'}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{v.client?.sector ?? '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="mono text-xs font-bold" style={{ color: '#F43F5E' }}>{v.violationCount} breaches</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>avg {v.avgDaysLate ?? 0}d late</p>
                  </div>
                  <span className="mono text-sm font-black w-8 text-right" style={{ color: getPdiColor(pdi) }}>{Math.round(pdi)}</span>
                </div>
              );
            })}
            {(topViolators?.length ?? 0) === 0 && <EmptyState icon={<AlertTriangle size={24} />} title="No violators found" />}
          </div>
        </div>
      </div>

      {/* Violation Log */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>SLA Violation Log</h2>
          <GhostButton onClick={() => violations.length > 0 && exportCsv(violations)} disabled={violations.length === 0}>
            <Download size={11} className="inline mr-1" />Export CSV
          </GhostButton>
        </div>
        {isLoading ? <SkeletonTable rows={8} /> : violations.length === 0 ? (
          <EmptyState icon={<AlertTriangle size={32} />} title="No SLA violations" sub="All clients are within payment terms" />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Invoice', 'Client', 'Sector', 'Amount', 'Breach Date', 'Days Late', 'PDI', 'Repeat', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {violations.map((v: SlaViolation) => {
                const pdi      = Number(v.client?.paymentDisciplineIndex ?? 50);
                const isRepeat = (topViolators ?? []).some((tv: any) => tv.clientId === v.clientId && tv.violationCount > 1);
                return (
                  <tr key={v.id} className="border-b hover:opacity-90 transition-colors" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3 mono text-[11px]" style={{ color: 'var(--text-3)' }}>{v.invoice?.invoiceNumber ?? '—'}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{v.client?.name ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-3)' }}>{v.client?.sector ?? '—'}</td>
                    <td className="px-4 py-3 mono font-semibold" style={{ color: 'var(--text)' }}>
                      {v.invoice?.invoiceAmount ? fmtCurrency(Number(v.invoice.invoiceAmount)) : '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-2)' }}>{fmtDate(v.violationDate)}</td>
                    <td className="px-4 py-3">
                      <span className="mono font-black text-sm" style={{ color: v.daysLate > 14 ? '#F43F5E' : '#F59E0B' }}>
                        {v.daysLate}d
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="mono text-xs font-bold" style={{ color: getPdiColor(pdi) }}>{Math.round(pdi)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge style={isRepeat ? { background: 'rgba(244,63,94,0.12)', color: '#F43F5E' } : { background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
                        {isRepeat ? 'YES' : 'NO'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge style={v.resolved ? { background: 'rgba(16,185,129,0.1)', color: '#10B981' } : { background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                        {v.resolved ? 'RESOLVED' : 'OPEN'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {violationsData?.meta && violationsData.meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text-3)' }}>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, violationsData.meta.total)} of {violationsData.meta.total} violations
            </span>
            <div className="flex items-center gap-1">
              <GhostButton onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</GhostButton>
              {Array.from({ length: Math.min(5, violationsData.meta.totalPages) }, (_, i) => {
                const pg = Math.max(1, Math.min(violationsData.meta.totalPages - 4, page - 2)) + i;
                return pg <= violationsData.meta.totalPages ? (
                  <button key={pg} onClick={() => setPage(pg)}
                    className="w-7 h-7 rounded text-[11px] font-medium transition-all"
                    style={{ background: pg === page ? 'var(--amber)' : 'transparent', color: pg === page ? '#000' : 'var(--text-3)' }}>
                    {pg}
                  </button>
                ) : null;
              })}
              <GhostButton onClick={() => setPage(p => Math.min(violationsData.meta.totalPages, p + 1))} disabled={page === violationsData.meta.totalPages}>Next →</GhostButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}