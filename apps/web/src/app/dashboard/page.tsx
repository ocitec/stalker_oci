'use client';

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { Clock } from 'lucide-react';
import { useDashboard, useDsoTrend } from '@/lib/hooks/useApi';
import { KpiCard, SkeletonCard, SectionTitle, Badge, PdiBar } from '@/components/ui';
import {
  fmtCurrency, getPdiColor, getPdiLabel,
  getRiskBadgeClass, fmtDate,
} from '@/lib/utils';

const AGING_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#F97316', '#F43F5E'];

// ── Custom tooltip for DSO chart ──────────────────────────────────────────────
function DsoTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1A2236', border: '1px solid #2A3A5C', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: '#8B9DC3', marginBottom: 4 }}>{label}</p>
      <p style={{ color: '#F59E0B', fontFamily: 'monospace', fontWeight: 700 }}>
        {payload[0].value} days
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading }    = useDashboard();
  const { data: dsoTrendData } = useDsoTrend();

  // ── Chart data ──────────────────────────────────────────────────────────────
  const agingChartData = data ? [
    { name: 'Current', value: data.agingBuckets.current.value  / 1000 },
    { name: '1–30d',   value: data.agingBuckets['1_30'].value  / 1000 },
    { name: '31–60d',  value: data.agingBuckets['31_60'].value / 1000 },
    { name: '61–90d',  value: data.agingBuckets['61_90'].value / 1000 },
    { name: '>90d',    value: data.agingBuckets.over_90.value  / 1000 },
  ] : [];

  // ── Fix #10: use real DSO trend data from /analytics/dso-trend ──────────────
  // Previously this was mapped from paymentTrend.paidValue — which is invoice
  // amounts, not DSO values. Now uses the dedicated endpoint.
  const dsoChartData = (dsoTrendData ?? []).map((point: { month: string; dso: number }) => ({
    month: point.month,
    dso:   Math.round(point.dso),
  }));

  const pdiPieData = data ? [
    { name: 'Reliable',  value: data.pdiDistribution.reliable,  color: '#10B981' },
    { name: 'Moderate',  value: data.pdiDistribution.moderate,  color: '#3B82F6' },
    { name: 'High Risk', value: data.pdiDistribution.highRisk,  color: '#F59E0B' },
    { name: 'Chronic',   value: data.pdiDistribution.chronic,   color: '#F43F5E' },
  ] : [];

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : data ? (
          <>
            <KpiCard
              label="Total Outstanding"
              value={fmtCurrency(data.kpis.totalOutstanding)}
              sub={`${data.kpis.overdueCount + data.kpis.dueTodayCount} need attention`}
              accent="var(--amber)"
            />
            <KpiCard
              label="Overdue Value"
              value={fmtCurrency(data.kpis.overdueValue)}
              trendLabel={`${data.kpis.overdueCount} overdue invoices`}
              trend="up"
              accent="var(--red)"
            />
            <KpiCard
              label="Avg DSO"
              value={`${data.kpis.dso}d`}
              trendLabel="Target: 38 days"
              trend={data.kpis.dso > 38 ? 'up' : 'down'}
            />
            <KpiCard
              label="Chronic Clients"
              value={data.kpis.chronicClients}
              sub="PDI below 40"
              accent="var(--red)"
            />
          </>
        ) : null}
      </div>

      {/* ── Charts Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Aging Buckets */}
        <div className="card p-5">
          <SectionTitle title="Aging Buckets (₦K)" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agingChartData} barSize={32}>
              <XAxis dataKey="name" tick={{ fill: '#5A6E96', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5A6E96', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₦${v}K`} />
              <Tooltip
                contentStyle={{ background: '#1A2236', border: '1px solid #2A3A5C', borderRadius: 8, color: '#E8EDF8', fontSize: 12 }}
                formatter={value => {
                  const amount = typeof value === 'number' ? value : Number(value || 0)
                  return [`₦${amount.toFixed(0)}K`, 'Outstanding']
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {agingChartData.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* DSO Trend — FIXED: uses real dso values, not paidValue amounts */}
        <div className="card p-5">
          <SectionTitle
            title="DSO Trend — 6 Months"
            badge={
              dsoChartData.length > 0 ? (
                <Badge style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--amber)', borderColor: 'rgba(245,158,11,0.2)' }}>
                  Latest: {dsoChartData[dsoChartData.length - 1]?.dso ?? '—'}d
                </Badge>
              ) : undefined
            }
          />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dsoChartData}>
              <defs>
                <linearGradient id="dsoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fill: '#5A6E96', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: '#5A6E96', fontSize: 10 }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `${v}d`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<DsoTooltip />} />
              <Area
                dataKey="dso"
                stroke="#F59E0B"
                fill="url(#dsoGrad)"
                strokeWidth={2}
                dot={{ r: 3, fill: '#F59E0B' }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          {dsoChartData.length === 0 && (
            <p className="text-xs text-center mt-4" style={{ color: 'var(--text-3)' }}>
              DSO trend data loading…
            </p>
          )}
        </div>
      </div>

      {/* ── Bottom Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Top Risk Clients */}
        <div className="card p-5 col-span-2">
          <SectionTitle
            title="Top Risk Clients"
            badge={
              <Badge style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E', borderColor: 'rgba(244,63,94,0.2)' }}>
                {data?.kpis.chronicClients ?? 0} chronic
              </Badge>
            }
          />
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Client', 'PDI', 'Outstanding', 'Risk', 'Status'].map(h => (
                  <th key={h} className="text-left pb-2 font-medium text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="py-2"><div className="skeleton h-4 w-full" /></td></tr>
                ))
              ) : (data?.topDefaulters ?? []).map((c: any) => (
                <tr
                  key={c.id}
                  className="border-b transition-colors hover:opacity-80"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="py-2.5 font-medium" style={{ color: 'var(--text)' }}>{c.name}</td>
                  <td className="py-2.5">
                    <PdiBar
                      value={Math.round(Number(c.paymentDisciplineIndex))}
                      color={getPdiColor(Number(c.paymentDisciplineIndex))}
                    />
                  </td>
                  <td className="py-2.5 mono font-medium" style={{ color: 'var(--text)' }}>
                    {fmtCurrency(c.outstandingAmount ?? 0)}
                  </td>
                  <td className="py-2.5">
                    <Badge className={getRiskBadgeClass(c.riskStatus)}>
                      {getPdiLabel(Number(c.paymentDisciplineIndex))}
                    </Badge>
                  </td>
                  <td className="py-2.5">
                    {c.isBlocked && (
                      <Badge style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>BLOCKED</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PDI Distribution Donut */}
        <div className="card p-5">
          <SectionTitle title="PDI Distribution" />
          <div className="flex justify-center mb-3">
            <PieChart width={140} height={140}>
              <Pie
                data={pdiPieData} cx={70} cy={70}
                innerRadius={45} outerRadius={65}
                paddingAngle={3} dataKey="value"
              >
                {pdiPieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1A2236', border: '1px solid #2A3A5C', borderRadius: 8, fontSize: 12 }}
                formatter={(v, name) => [v, name]}
              />
            </PieChart>
          </div>
          <div className="space-y-2">
            {pdiPieData.map(p => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.color }} />
                  <span style={{ color: 'var(--text-2)' }}>{p.name}</span>
                </div>
                <span className="mono font-bold" style={{ color: p.color }}>{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Follow-up Compliance strip ──────────────────────────────────────── */}
      {data && (
        <div className="card p-4 flex items-center gap-6">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Clock size={16} style={{ color: 'var(--amber)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Follow-up Compliance</span>
          </div>
          <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--bg-3)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${data.followUpCompliance.complianceRate}%`,
                background: data.followUpCompliance.complianceRate >= 70 ? 'var(--green)' : 'var(--amber)',
              }}
            />
          </div>
          <span className="mono text-sm font-bold flex-shrink-0" style={{ color: 'var(--text)' }}>
            {data.followUpCompliance.complianceRate}%
          </span>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>
            {data.followUpCompliance.staleCount} stale ·{' '}
            {data.followUpCompliance.overdueTotal} overdue
          </span>
        </div>
      )}
    </div>
  );
}
