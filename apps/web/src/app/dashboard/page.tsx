'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock, ChevronRight, Phone, AlertTriangle,
  CheckCircle2, ArrowUpRight, Target, TrendingUp,
} from 'lucide-react';
import { useDashboard, useAgingReport } from '@/lib/hooks/useApi';
import { KpiCard, SkeletonCard, SectionTitle, Badge, PdiBar, EmptyState } from '@/components/ui';
import {
  fmtCurrency, getPdiColor, getPdiLabel,
  getRiskBadgeClass, getFollowUpColor,
} from '@/lib/utils';
import { ClientDrawer } from '@/components/forms/ClientDrawer';
import { InvoiceDrawer } from '@/components/forms/InvoiceDrawer';
import { ActionSeverity } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function actionColor(s: ActionSeverity) {
  return s === 'CRITICAL' ? '#F43F5E' : s === 'HIGH' ? '#F97316' : s === 'MEDIUM' ? '#F59E0B' : '#3B82F6';
}
function actionBg(s: ActionSeverity) {
  return s === 'CRITICAL' ? 'rgba(244,63,94,0.12)' : s === 'HIGH' ? 'rgba(249,115,22,0.12)' : s === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)';
}
function actionBorder(s: ActionSeverity) {
  return s === 'CRITICAL' ? 'rgba(244,63,94,0.3)' : s === 'HIGH' ? 'rgba(249,115,22,0.3)' : s === 'MEDIUM' ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useDashboard();
  const { data: aging }     = useAgingReport();

  const [drawerClientId,  setDrawerClientId]  = useState<string | null>(null);
  const [drawerInvoiceId, setDrawerInvoiceId] = useState<string | null>(null);

  const weeklyTrend: { week: string; collected: number }[] =
    data?.collectionsPerformance?.weeklyTrend ?? [];
  const maxCollected = Math.max(...weeklyTrend.map(w => w.collected), 1);

  const fu = data?.followUpCompliance;
  const cp = data?.collectionsPerformance;

  // Aging buckets
  const agingBuckets = aging
    ? [
        { label: 'Current',  days: '0d',    value: aging.current?.value ?? 0, count: aging.current?.count ?? 0, color: '#10B981' },
        { label: '1–30d',    days: '1–30d', value: aging['1_30']?.value  ?? 0, count: aging['1_30']?.count  ?? 0, color: '#F59E0B' },
        { label: '31–60d',   days: '31–60d',value: aging['31_60']?.value ?? 0, count: aging['31_60']?.count ?? 0, color: '#F97316' },
        { label: '61–90d',   days: '61–90d',value: aging['61_90']?.value ?? 0, count: aging['61_90']?.count ?? 0, color: '#F43F5E' },
        { label: '90d+',     days: '90d+',  value: aging.over_90?.value  ?? 0, count: aging.over_90?.count  ?? 0, color: '#9333EA' },
      ]
    : [];
  const agingTotal = agingBuckets.reduce((s, b) => s + b.value, 0);

  return (
    <>
    <div className="space-y-5 animate-fade-in">

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : data ? (
          <>
            <div className="cursor-pointer transition-opacity hover:opacity-80" onClick={() => router.push('/dashboard/invoices')}>
              <KpiCard label="Total Outstanding" value={fmtCurrency(data.kpis.totalOutstanding)}
                sub={`${(data.kpis.overdueCount ?? 0) + (data.kpis.dueTodayCount ?? 0)} invoices need attention`} accent="var(--amber)" />
            </div>
            <div className="cursor-pointer transition-opacity hover:opacity-80" onClick={() => router.push('/dashboard/invoices?status=OVERDUE')}>
              <KpiCard label="Total Overdue" value={fmtCurrency(data.kpis.overdueValue)}
                trendLabel={`${data.kpis.overdueCount} overdue invoices`} trend="up" accent="var(--red)" />
            </div>
            <div className="cursor-pointer transition-opacity hover:opacity-80" onClick={() => router.push('/dashboard/invoices?status=OVERDUE')}>
              <KpiCard label="Overdue %" value={`${data.kpis.overduePercent}%`} sub="of total outstanding"
                accent={data.kpis.overduePercent > 50 ? 'var(--red)' : data.kpis.overduePercent > 30 ? 'var(--amber)' : 'var(--text)'} />
            </div>
            <div className="cursor-pointer transition-opacity hover:opacity-80" onClick={() => router.push('/dashboard/invoices?status=DUE_TODAY')}>
              <KpiCard label="Due Today" value={data.kpis.dueTodayCount}
                sub={`${data.kpis.chronicClients} chronic · ${data.kpis.blockedClients} blocked`}
                accent={data.kpis.dueTodayCount > 0 ? 'var(--amber)' : 'var(--text)'} />
            </div>
          </>
        ) : null}
      </div>

      {/* ── Cash-at-Risk Aging Breakdown ──────────────────────────────────── */}
      {agingTotal > 0 && (
        <div className="card p-5">
          <SectionTitle
            title="Cash-at-Risk — Aging Breakdown"
            action={
              <button onClick={() => router.push('/dashboard/invoices')}
                className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--amber)' }}>
                Drill into invoices <ChevronRight size={12} />
              </button>
            }
          />
          {/* Proportional colour bar */}
          <div className="flex rounded-full overflow-hidden h-3 mb-4 mt-3">
            {agingBuckets.map(b =>
              b.value > 0 ? (
                <div
                  key={b.label}
                  style={{ width: `${(b.value / agingTotal) * 100}%`, background: b.color }}
                  title={`${b.label}: ${fmtCurrency(b.value)}`}
                />
              ) : null,
            )}
          </div>
          {/* Bucket breakdown */}
          <div className="grid grid-cols-5 gap-2">
            {agingBuckets.map(b => (
              <div
                key={b.label}
                className="p-3 rounded-lg cursor-pointer transition-opacity hover:opacity-80 text-center"
                style={{ background: 'var(--bg-2)', border: `1px solid ${b.color}22` }}
                onClick={() => router.push('/dashboard/invoices')}
              >
                <p className="text-[9px] uppercase tracking-wide font-semibold mb-1" style={{ color: b.color }}>
                  {b.label}
                </p>
                <p className="mono text-sm font-black" style={{ color: b.value > 0 ? b.color : 'var(--text-3)' }}>
                  {fmtCurrency(b.value)}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {b.count} invoice{b.count !== 1 ? 's' : ''}
                  {agingTotal > 0 && b.value > 0 && (
                    <> · {Math.round((b.value / agingTotal) * 100)}%</>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Follow-Up Monitoring ─────────────────────────────────────────── */}
      <div className="card p-5">
        <SectionTitle
          title="Follow-Up Monitoring"
          badge={
            (fu?.overdueFollowUps ?? 0) > 0
              ? <Badge style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E', borderColor: 'rgba(244,63,94,0.2)' }}>
                  {fu?.overdueFollowUps} overdue
                </Badge>
              : <Badge style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', borderColor: 'rgba(16,185,129,0.2)' }}>
                  On Track
                </Badge>
          }
          action={
            <button onClick={() => router.push('/dashboard/followups')}
              className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
              style={{ color: 'var(--amber)' }}>
              Manage follow-ups <ChevronRight size={12} />
            </button>
          }
        />
        <div className="grid grid-cols-4 gap-3 mt-3">
          {[
            { icon: <Clock size={13} style={{ color: 'var(--amber)' }} />, label: 'Due Today',
              value: fu?.followUpsDueToday ?? 0, accent: 'var(--amber)', alert: (fu?.followUpsDueToday ?? 0) > 0, link: '/dashboard/followups' },
            { icon: <AlertTriangle size={13} style={{ color: '#F43F5E' }} />, label: 'Overdue Follow-Ups',
              value: fu?.overdueFollowUps ?? 0, accent: '#F43F5E', alert: (fu?.overdueFollowUps ?? 0) > 0, link: '/dashboard/followups' },
            { icon: <CheckCircle2 size={13} style={{ color: 'var(--green)' }} />, label: 'Compliance',
              value: `${fu?.complianceRate ?? 0}%`, accent: (fu?.complianceRate ?? 0) >= 70 ? 'var(--green)' : 'var(--amber)',
              alert: false, bar: fu?.complianceRate ?? 0, link: '/dashboard/followups' },
            { icon: <ArrowUpRight size={13} style={{ color: '#F97316' }} />, label: 'Escalations',
              value: fu?.escalationsPending ?? 0, accent: '#F97316', alert: (fu?.escalationsPending ?? 0) > 0, link: '/dashboard/alerts' },
          ].map(tile => (
            <div key={tile.label}
              className="p-4 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
              style={{
                background: tile.alert ? `${tile.accent}14` : 'var(--bg-2)',
                border: `1px solid ${tile.alert ? `${tile.accent}33` : 'var(--border)'}`,
              }}
              onClick={() => router.push(tile.link as any)}
            >
              <div className="flex items-center gap-2 mb-2">
                {tile.icon}
                <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-3)' }}>
                  {tile.label}
                </span>
              </div>
              <p className="mono text-2xl font-black" style={{ color: isLoading ? 'var(--text-3)' : tile.accent }}>
                {isLoading ? '—' : tile.value}
              </p>
              {'bar' in tile && (
                <div className="h-1 rounded-full mt-2" style={{ background: 'var(--bg-3)' }}>
                  <div className="h-full rounded-full" style={{ width: `${tile.bar}%`, background: tile.accent }} />
                </div>
              )}
            </div>
          ))}
        </div>
        {!isLoading && (fu?.completedToday ?? 0) > 0 && (
          <p className="text-[11px] mt-3" style={{ color: 'var(--text-3)' }}>
            <span className="mono font-bold" style={{ color: 'var(--green)' }}>{fu?.completedToday}</span>
            {' '}follow-up{(fu?.completedToday ?? 0) !== 1 ? 's' : ''} logged today
            {(fu?.staleCount ?? 0) > 0 && (
              <> · <span className="mono font-bold" style={{ color: '#F43F5E' }}>{fu?.staleCount}</span> stale (no contact in 5d)</>
            )}
          </p>
        )}
      </div>

      {/* ── Action Centre ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Top 5 Clients to Chase */}
        <div className="card p-5">
          <SectionTitle
            title="Top Clients to Chase Today"
            badge={<Badge style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E', borderColor: 'rgba(244,63,94,0.2)' }}>Action Required</Badge>}
            action={
              <button onClick={() => router.push('/dashboard/clients')}
                className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--amber)' }}>
                All clients <ChevronRight size={12} />
              </button>
            }
          />
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-20 w-full rounded-lg" />)}</div>
          ) : (data?.actionCentre?.clientsToChase ?? []).length === 0 ? (
            <EmptyState icon={<Phone size={28} />} title="No overdue clients" sub="All clients are within payment terms" />
          ) : (
            <div className="space-y-2">
              {(data.actionCentre.clientsToChase ?? []).map((c: any, i: number) => {
                const rec = c.recommendedAction;
                return (
                  <div
                    key={c.id}
                    className="rounded-lg overflow-hidden cursor-pointer transition-opacity hover:opacity-80"
                    style={{ border: `1px solid ${rec ? actionBorder(rec.severity) : 'var(--border)'}` }}
                    onClick={() => setDrawerClientId(c.id)}
                  >
                    {/* Action banner — most prominent element */}
                    {rec && (
                      <div
                        className="flex items-center justify-between px-3 py-2"
                        style={{ background: actionBg(rec.severity), borderBottom: `1px solid ${actionBorder(rec.severity)}` }}
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={11} style={{ color: actionColor(rec.severity), flexShrink: 0 }} />
                          <span className="text-[11px] font-bold" style={{ color: actionColor(rec.severity) }}>
                            {rec.action}
                          </span>
                        </div>
                        <Badge style={{ fontSize: 9, background: 'transparent', color: actionColor(rec.severity), borderColor: actionBorder(rec.severity) }}>
                          {rec.severity}
                        </Badge>
                      </div>
                    )}
                    {/* Client info row */}
                    <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: 'var(--bg-2)' }}>
                      <span className="text-xs font-bold w-5 flex-shrink-0 text-center" style={{ color: 'var(--text-3)' }}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{c.name}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                          {c.overdueInvoiceCount} inv · {c.maxDaysOverdue}d overdue
                          {c.daysSinceFollowUp !== null ? ` · last contact ${c.daysSinceFollowUp}d ago` : ' · no contact'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="mono text-sm font-bold" style={{ color: 'var(--red)' }}>{fmtCurrency(c.overdueAmount)}</p>
                        <Badge className={getRiskBadgeClass(c.riskStatus)}>{getPdiLabel(c.paymentDisciplineIndex)}</Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top 10 Overdue Invoices */}
        <div className="card p-5">
          <SectionTitle
            title="Top Overdue Invoices"
            badge={<Badge style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316', borderColor: 'rgba(249,115,22,0.2)' }}>{data?.kpis?.overdueCount ?? 0} total</Badge>}
            action={
              <button onClick={() => router.push('/dashboard/invoices?status=OVERDUE')}
                className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--amber)' }}>
                View all <ChevronRight size={12} />
              </button>
            }
          />
          <div style={{ overflowY: 'auto', maxHeight: 300 }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Invoice', 'Client', 'Outstanding', '+Days', 'Contact'].map(h => (
                    <th key={h} className="text-left pb-2 font-medium text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={5} className="py-2"><div className="skeleton h-4 w-full" /></td></tr>
                  ))
                ) : (data?.actionCentre?.topOverdueInvoices ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-xs" style={{ color: 'var(--text-3)' }}>No overdue invoices</td></tr>
                ) : (
                  (data.actionCentre.topOverdueInvoices ?? []).map((inv: any) => (
                    <tr key={inv.id} className="border-b cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ borderColor: 'var(--border)' }} onClick={() => setDrawerInvoiceId(inv.id)}>
                      <td className="py-2.5 mono font-medium" style={{ color: 'var(--text-2)' }}>{inv.invoiceNumber}</td>
                      <td className="py-2.5 font-medium hover:underline"
                        style={{ color: 'var(--text)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        onClick={e => { e.stopPropagation(); setDrawerClientId(inv.clientId); }}>
                        {inv.clientName}
                      </td>
                      <td className="py-2.5 mono font-bold" style={{ color: 'var(--red)' }}>{fmtCurrency(inv.remainingBalance)}</td>
                      <td className="py-2.5">
                        <span className="mono font-bold" style={{ color: inv.daysOverdue > 60 ? '#F43F5E' : inv.daysOverdue > 30 ? '#F97316' : '#F59E0B' }}>
                          +{inv.daysOverdue}d
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span style={{ color: getFollowUpColor(inv.daysSinceFollowUp) }}>
                          {inv.daysSinceFollowUp === null ? 'None' : `${inv.daysSinceFollowUp}d ago`}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Credit Enforcement + SLA & Collections ────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Credit Enforcement */}
        <div className="card p-5">
          <SectionTitle title="Credit Enforcement"
            action={<button onClick={() => router.push('/dashboard/clients')}
              className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
              style={{ color: 'var(--amber)' }}>Manage clients <ChevronRight size={12} /></button>}
          />
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { value: data?.creditEnforcement?.totalBreaches ?? 0,                       label: 'Limit Breaches',  accent: 'var(--red)',   bg: 'rgba(244,63,94,0.08)',   border: 'rgba(244,63,94,0.15)',  link: '/dashboard/clients' },
              { value: data?.creditEnforcement?.totalNearLimit ?? 0,                      label: 'Near Limit ≥80%', accent: 'var(--amber)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', link: '/dashboard/clients' },
              { value: data?.creditEnforcement?.recommendCreditHold?.length ?? 0,         label: 'Recommend Hold',  accent: '#F97316',       bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.15)', link: '/dashboard/clients?riskStatus=HIGH_RISK' },
            ].map(m => (
              <div key={m.label} className="rounded-lg p-3 text-center cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: m.bg, border: `1px solid ${m.border}` }}
                onClick={() => router.push(m.link as any)}>
                <p className="mono text-2xl font-bold" style={{ color: m.accent }}>{isLoading ? '—' : m.value}</p>
                <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-3)' }}>{m.label}</p>
              </div>
            ))}
          </div>

          {(data?.creditEnforcement?.breaches ?? []).length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--text-3)' }}>Credit Limit Breached</p>
              <div className="space-y-1.5">
                {(data.creditEnforcement.breaches ?? []).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between text-xs p-2.5 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.1)' }}
                    onClick={() => setDrawerClientId(c.id)}>
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: 'var(--text)', maxWidth: 130 }}>{c.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>Limit: {fmtCurrency(c.creditLimit)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="mono text-xs" style={{ color: 'var(--text-2)' }}>{fmtCurrency(c.outstandingAmount)}</span>
                      <Badge style={{ background: 'rgba(244,63,94,0.15)', color: '#F43F5E', borderColor: 'rgba(244,63,94,0.2)' }}>{c.utilizationPercent}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(data?.creditEnforcement?.recommendCreditHold ?? []).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--text-3)' }}>Recommended for Credit Hold</p>
              <div className="space-y-1.5">
                {(data.creditEnforcement.recommendCreditHold ?? []).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between text-xs p-2.5 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.1)' }}
                    onClick={() => setDrawerClientId(c.id)}>
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: 'var(--text)', maxWidth: 130 }}>{c.name}</p>
                      <PdiBar value={c.paymentDisciplineIndex} color={getPdiColor(c.paymentDisciplineIndex)} />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="mono text-xs" style={{ color: 'var(--red)' }}>{fmtCurrency(c.outstandingAmount)}</span>
                      <Badge className={getRiskBadgeClass(c.riskStatus)}>{getPdiLabel(c.paymentDisciplineIndex)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading && (data?.creditEnforcement?.totalBreaches ?? 0) === 0 && (data?.creditEnforcement?.recommendCreditHold?.length ?? 0) === 0 && (
            <div className="py-6 text-center">
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>No credit enforcement actions required</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* SLA Monitoring */}
          <div className="card p-5">
            <SectionTitle title="SLA Monitoring"
              action={<button onClick={() => router.push('/dashboard/sla')}
                className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--amber)' }}>View breaches <ChevronRight size={12} /></button>}
            />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg p-3 cursor-pointer transition-opacity hover:opacity-80" style={{ background: 'var(--bg-2)' }}
                onClick={() => router.push('/dashboard/sla')}>
                <p className="mono text-2xl font-bold"
                  style={{ color: (data?.slaSummary?.unresolvedViolations ?? 0) > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {isLoading ? '—' : (data?.slaSummary?.unresolvedViolations ?? 0)}
                </p>
                <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-3)' }}>Unresolved Breaches</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-2)' }}>
                <p className="mono text-2xl font-bold" style={{ color: 'var(--amber)' }}>
                  {isLoading ? '—' : `${data?.slaSummary?.averageDaysLate ?? 0}d`}
                </p>
                <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-3)' }}>Avg Days Late</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock size={13} style={{ color: 'var(--amber)', flexShrink: 0 }} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-2)' }}>Follow-up Compliance</span>
                  <span className="mono text-[11px] font-bold" style={{ color: 'var(--text)' }}>{data?.followUpCompliance?.complianceRate ?? 0}%</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-3)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${data?.followUpCompliance?.complianceRate ?? 0}%`, background: (data?.followUpCompliance?.complianceRate ?? 0) >= 70 ? 'var(--green)' : 'var(--amber)' }} />
                </div>
              </div>
              <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-3)' }}>{data?.followUpCompliance?.staleCount ?? 0} stale</span>
            </div>
          </div>

          {/* Recovery Performance */}
          <div className="card p-5">
            <SectionTitle
              title="Recovery Performance"
              badge={
                <Badge style={{
                  background: (cp?.targetAchievement ?? 0) >= 80 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                  color: (cp?.targetAchievement ?? 0) >= 80 ? '#10B981' : 'var(--amber)',
                  borderColor: (cp?.targetAchievement ?? 0) >= 80 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                }}>
                  {cp?.targetAchievement ?? 0}% of target
                </Badge>
              }
            />

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="mono text-xl font-bold" style={{ color: 'var(--green)' }}>{fmtCurrency(cp?.collectedThisWeek ?? 0)}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>collected this week</p>
              </div>
              <div>
                <p className="mono text-xl font-bold" style={{ color: 'var(--amber)' }}>{fmtCurrency(cp?.weeklyTarget ?? 0)}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>weekly target (10% of overdue)</p>
              </div>
            </div>

            {(cp?.weeklyTarget ?? 0) > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>Target progress</span>
                  <span className="mono text-[10px] font-bold" style={{ color: 'var(--text-2)' }}>{Math.min(100, cp?.targetAchievement ?? 0)}%</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-3)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, cp?.targetAchievement ?? 0)}%`, background: (cp?.targetAchievement ?? 0) >= 80 ? 'var(--green)' : 'var(--amber)' }} />
                </div>
                <div className="flex justify-between mt-1">
                  {(cp?.recoveryGap ?? 0) > 0 && (
                    <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                      Gap: <span className="mono font-semibold" style={{ color: '#F97316' }}>{fmtCurrency(cp?.recoveryGap ?? 0)}</span>
                    </p>
                  )}
                  <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                    Expected recoverable: <span className="mono font-semibold" style={{ color: 'var(--text-2)' }}>{fmtCurrency(cp?.expectedRecoverable ?? 0)}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Weekly trend bars */}
            <div className="flex items-end gap-2" style={{ height: 44 }}>
              {weeklyTrend.length === 0
                ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex-1 rounded-t" style={{ height: 4, background: 'var(--bg-3)', alignSelf: 'flex-end' }} />)
                : weeklyTrend.map((w, i) => {
                    const barH = Math.max(4, Math.round((w.collected / maxCollected) * 40));
                    const isLatest = i === weeklyTrend.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
                        <div className="w-full rounded-t transition-all"
                          style={{ height: barH, background: isLatest ? 'var(--green)' : 'var(--bg-3)' }}
                          title={`${w.week}: ${fmtCurrency(w.collected)}`} />
                        <span className="text-[9px] leading-none" style={{ color: 'var(--text-3)' }}>{w.week}</span>
                      </div>
                    );
                  })}
            </div>
          </div>

        </div>
      </div>

    </div>

    <ClientDrawer clientId={drawerClientId} onClose={() => setDrawerClientId(null)}
      onViewInvoice={id => { setDrawerClientId(null); setDrawerInvoiceId(id); }} />
    <InvoiceDrawer invoiceId={drawerInvoiceId} onClose={() => setDrawerInvoiceId(null)} />
    </>
  );
}
