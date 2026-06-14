'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock, ChevronRight, Phone, AlertTriangle, TrendingUp,
  CheckCircle2, Users, ArrowUpRight, Target,
} from 'lucide-react';
import { useDashboard } from '@/lib/hooks/useApi';
import { KpiCard, SkeletonCard, SectionTitle, Badge, PdiBar, EmptyState } from '@/components/ui';
import {
  fmtCurrency, getPdiColor, getPdiLabel,
  getRiskBadgeClass, getFollowUpColor,
} from '@/lib/utils';
import { ClientDrawer } from '@/components/forms/ClientDrawer';
import { InvoiceDrawer } from '@/components/forms/InvoiceDrawer';
import { ActionSeverity } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getActionColor(severity: ActionSeverity): string {
  switch (severity) {
    case 'CRITICAL': return '#F43F5E';
    case 'HIGH':     return '#F97316';
    case 'MEDIUM':   return '#F59E0B';
    default:         return '#3B82F6';
  }
}

function getActionBg(severity: ActionSeverity): string {
  switch (severity) {
    case 'CRITICAL': return 'rgba(244,63,94,0.12)';
    case 'HIGH':     return 'rgba(249,115,22,0.12)';
    case 'MEDIUM':   return 'rgba(245,158,11,0.12)';
    default:         return 'rgba(59,130,246,0.12)';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useDashboard();

  const [drawerClientId,  setDrawerClientId]  = useState<string | null>(null);
  const [drawerInvoiceId, setDrawerInvoiceId] = useState<string | null>(null);

  const weeklyTrend: { week: string; collected: number }[] =
    data?.collectionsPerformance?.weeklyTrend ?? [];
  const maxCollected = Math.max(...weeklyTrend.map(w => w.collected), 1);

  const fu = data?.followUpCompliance;
  const cp = data?.collectionsPerformance;

  return (
    <>
    <div className="space-y-5 animate-fade-in">

      {/* ── KPI Cards — clickable drill-down ──────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : data ? (
          <>
            <div
              className="cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => router.push('/dashboard/invoices')}
            >
              <KpiCard
                label="Total Outstanding"
                value={fmtCurrency(data.kpis.totalOutstanding)}
                sub={`${(data.kpis.overdueCount ?? 0) + (data.kpis.dueTodayCount ?? 0)} invoices need attention`}
                accent="var(--amber)"
              />
            </div>
            <div
              className="cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => router.push('/dashboard/invoices?status=OVERDUE')}
            >
              <KpiCard
                label="Total Overdue"
                value={fmtCurrency(data.kpis.overdueValue)}
                trendLabel={`${data.kpis.overdueCount} overdue invoices`}
                trend="up"
                accent="var(--red)"
              />
            </div>
            <div
              className="cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => router.push('/dashboard/invoices?status=OVERDUE')}
            >
              <KpiCard
                label="Overdue %"
                value={`${data.kpis.overduePercent}%`}
                sub="of total outstanding"
                accent={
                  data.kpis.overduePercent > 50
                    ? 'var(--red)'
                    : data.kpis.overduePercent > 30
                    ? 'var(--amber)'
                    : 'var(--text)'
                }
              />
            </div>
            <div
              className="cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => router.push('/dashboard/invoices?status=DUE_TODAY')}
            >
              <KpiCard
                label="Due Today"
                value={data.kpis.dueTodayCount}
                sub={`${data.kpis.chronicClients} chronic · ${data.kpis.blockedClients} blocked`}
                accent={data.kpis.dueTodayCount > 0 ? 'var(--amber)' : 'var(--text)'}
              />
            </div>
          </>
        ) : null}
      </div>

      {/* ── Follow-Up Monitoring (primary feature) ────────────────────── */}
      <div className="card p-5">
        <SectionTitle
          title="Follow-Up Monitoring"
          badge={
            (fu?.overdueFollowUps ?? 0) > 0 ? (
              <Badge style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E', borderColor: 'rgba(244,63,94,0.2)' }}>
                {fu?.overdueFollowUps} overdue
              </Badge>
            ) : (
              <Badge style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', borderColor: 'rgba(16,185,129,0.2)' }}>
                On Track
              </Badge>
            )
          }
          action={
            <button
              onClick={() => router.push('/dashboard/followups')}
              className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
              style={{ color: 'var(--amber)' }}
            >
              Manage follow-ups <ChevronRight size={12} />
            </button>
          }
        />

        <div className="grid grid-cols-4 gap-3 mt-3">
          {/* Follow-Ups Due Today */}
          <div
            className="p-4 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
            style={{ background: (fu?.followUpsDueToday ?? 0) > 0 ? 'rgba(245,158,11,0.08)' : 'var(--bg-2)', border: `1px solid ${(fu?.followUpsDueToday ?? 0) > 0 ? 'rgba(245,158,11,0.2)' : 'var(--border)'}` }}
            onClick={() => router.push('/dashboard/followups')}
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock size={13} style={{ color: 'var(--amber)' }} />
              <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-3)' }}>Due Today</span>
            </div>
            <p className="mono text-2xl font-black" style={{ color: (fu?.followUpsDueToday ?? 0) > 0 ? 'var(--amber)' : 'var(--text)' }}>
              {isLoading ? '—' : (fu?.followUpsDueToday ?? 0)}
            </p>
          </div>

          {/* Overdue Follow-Ups */}
          <div
            className="p-4 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
            style={{ background: (fu?.overdueFollowUps ?? 0) > 0 ? 'rgba(244,63,94,0.08)' : 'var(--bg-2)', border: `1px solid ${(fu?.overdueFollowUps ?? 0) > 0 ? 'rgba(244,63,94,0.2)' : 'var(--border)'}` }}
            onClick={() => router.push('/dashboard/followups')}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={13} style={{ color: '#F43F5E' }} />
              <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-3)' }}>Overdue Follow-Ups</span>
            </div>
            <p className="mono text-2xl font-black" style={{ color: (fu?.overdueFollowUps ?? 0) > 0 ? '#F43F5E' : 'var(--text)' }}>
              {isLoading ? '—' : (fu?.overdueFollowUps ?? 0)}
            </p>
          </div>

          {/* Compliance % */}
          <div
            className="p-4 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
            onClick={() => router.push('/dashboard/followups')}
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={13} style={{ color: 'var(--green)' }} />
              <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-3)' }}>Compliance</span>
            </div>
            <p className="mono text-2xl font-black" style={{ color: (fu?.complianceRate ?? 0) >= 70 ? 'var(--green)' : 'var(--amber)' }}>
              {isLoading ? '—' : `${fu?.complianceRate ?? 0}%`}
            </p>
            <div className="h-1 rounded-full mt-2" style={{ background: 'var(--bg-3)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${fu?.complianceRate ?? 0}%`,
                  background: (fu?.complianceRate ?? 0) >= 70 ? 'var(--green)' : 'var(--amber)',
                }}
              />
            </div>
          </div>

          {/* Escalations Pending */}
          <div
            className="p-4 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
            style={{ background: (fu?.escalationsPending ?? 0) > 0 ? 'rgba(249,115,22,0.08)' : 'var(--bg-2)', border: `1px solid ${(fu?.escalationsPending ?? 0) > 0 ? 'rgba(249,115,22,0.2)' : 'var(--border)'}` }}
            onClick={() => router.push('/dashboard/alerts')}
          >
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight size={13} style={{ color: '#F97316' }} />
              <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-3)' }}>Escalations</span>
            </div>
            <p className="mono text-2xl font-black" style={{ color: (fu?.escalationsPending ?? 0) > 0 ? '#F97316' : 'var(--text)' }}>
              {isLoading ? '—' : (fu?.escalationsPending ?? 0)}
            </p>
          </div>
        </div>

        {/* Summary line */}
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

        {/* Top 5 Clients to Chase Today */}
        <div className="card p-5">
          <SectionTitle
            title="Top Clients to Chase Today"
            badge={
              <Badge style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E', borderColor: 'rgba(244,63,94,0.2)' }}>
                Action Required
              </Badge>
            }
            action={
              <button
                onClick={() => router.push('/dashboard/clients')}
                className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--amber)' }}
              >
                View all clients <ChevronRight size={12} />
              </button>
            }
          />
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : (data?.actionCentre?.clientsToChase ?? []).length === 0 ? (
            <EmptyState
              icon={<Phone size={28} />}
              title="No overdue clients"
              sub="All clients are within payment terms"
            />
          ) : (
            <div className="space-y-2">
              {(data.actionCentre.clientsToChase ?? []).map((c: any, i: number) => (
                <div
                  key={c.id}
                  className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                  style={{
                    background: 'var(--bg-2)',
                    borderLeft: `3px solid ${getPdiColor(c.paymentDisciplineIndex)}`,
                  }}
                  onClick={() => setDrawerClientId(c.id)}
                >
                  <span
                    className="text-xs font-bold w-5 flex-shrink-0 text-center mt-0.5"
                    style={{ color: 'var(--text-3)' }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {c.name}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {c.overdueInvoiceCount} invoice{c.overdueInvoiceCount !== 1 ? 's' : ''}
                      {' · '}{c.maxDaysOverdue}d overdue
                      {c.daysSinceFollowUp !== null
                        ? ` · last contact ${c.daysSinceFollowUp}d ago`
                        : ' · no contact logged'}
                    </p>
                    {/* Recommended action badge */}
                    {c.recommendedAction && (
                      <span
                        className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: getActionBg(c.recommendedAction.severity),
                          color: getActionColor(c.recommendedAction.severity),
                        }}
                      >
                        ↗ {c.recommendedAction.action}
                      </span>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="mono text-sm font-bold" style={{ color: 'var(--red)' }}>
                      {fmtCurrency(c.overdueAmount)}
                    </p>
                    <Badge className={getRiskBadgeClass(c.riskStatus)}>
                      {getPdiLabel(c.paymentDisciplineIndex)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 10 Overdue Invoices */}
        <div className="card p-5">
          <SectionTitle
            title="Top Overdue Invoices"
            badge={
              <Badge style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316', borderColor: 'rgba(249,115,22,0.2)' }}>
                {data?.kpis?.overdueCount ?? 0} total
              </Badge>
            }
            action={
              <button
                onClick={() => router.push('/dashboard/invoices?status=OVERDUE')}
                className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--amber)' }}
              >
                View all <ChevronRight size={12} />
              </button>
            }
          />
          <div style={{ overflowY: 'auto', maxHeight: 280 }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Invoice', 'Client', 'Balance', '+Days', 'Contact'].map(h => (
                    <th
                      key={h}
                      className="text-left pb-2 font-medium text-[10px] uppercase tracking-wide"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="py-2">
                        <div className="skeleton h-4 w-full" />
                      </td>
                    </tr>
                  ))
                ) : (data?.actionCentre?.topOverdueInvoices ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs" style={{ color: 'var(--text-3)' }}>
                      No overdue invoices
                    </td>
                  </tr>
                ) : (
                  (data.actionCentre.topOverdueInvoices ?? []).map((inv: any) => (
                    <tr
                      key={inv.id}
                      className="border-b cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ borderColor: 'var(--border)' }}
                      onClick={() => setDrawerInvoiceId(inv.id)}
                    >
                      <td className="py-2.5 mono font-medium" style={{ color: 'var(--text-2)' }}>
                        {inv.invoiceNumber}
                      </td>
                      <td
                        className="py-2.5 font-medium cursor-pointer hover:underline"
                        style={{ color: 'var(--text)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        onClick={e => { e.stopPropagation(); setDrawerClientId(inv.clientId); }}
                      >
                        {inv.clientName}
                      </td>
                      <td className="py-2.5 mono font-bold" style={{ color: 'var(--red)' }}>
                        {fmtCurrency(inv.remainingBalance)}
                      </td>
                      <td className="py-2.5">
                        <span
                          className="mono font-bold"
                          style={{
                            color: inv.daysOverdue > 60
                              ? '#F43F5E'
                              : inv.daysOverdue > 30
                              ? '#F97316'
                              : '#F59E0B',
                          }}
                        >
                          +{inv.daysOverdue}d
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span style={{ color: getFollowUpColor(inv.daysSinceFollowUp) }}>
                          {inv.daysSinceFollowUp === null
                            ? 'None'
                            : `${inv.daysSinceFollowUp}d ago`}
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
          <SectionTitle
            title="Credit Enforcement"
            action={
              <button
                onClick={() => router.push('/dashboard/clients')}
                className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--amber)' }}
              >
                Manage clients <ChevronRight size={12} />
              </button>
            }
          />

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div
              className="rounded-lg p-3 text-center cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)' }}
              onClick={() => router.push('/dashboard/clients?riskStatus=CHRONIC')}
            >
              <p className="mono text-2xl font-bold" style={{ color: 'var(--red)' }}>
                {isLoading ? '—' : (data?.creditEnforcement?.totalBreaches ?? 0)}
              </p>
              <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-3)' }}>
                Limit Breaches
              </p>
            </div>
            <div
              className="rounded-lg p-3 text-center cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}
              onClick={() => router.push('/dashboard/clients')}
            >
              <p className="mono text-2xl font-bold" style={{ color: 'var(--amber)' }}>
                {isLoading ? '—' : (data?.creditEnforcement?.totalNearLimit ?? 0)}
              </p>
              <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-3)' }}>
                Near Limit ≥80%
              </p>
            </div>
            <div
              className="rounded-lg p-3 text-center cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}
              onClick={() => router.push('/dashboard/clients?riskStatus=HIGH_RISK')}
            >
              <p className="mono text-2xl font-bold" style={{ color: '#F97316' }}>
                {isLoading ? '—' : (data?.creditEnforcement?.recommendCreditHold?.length ?? 0)}
              </p>
              <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-3)' }}>
                Recommend Hold
              </p>
            </div>
          </div>

          {(data?.creditEnforcement?.breaches ?? []).length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
                Credit Limit Breached
              </p>
              <div className="space-y-1.5">
                {(data.creditEnforcement.breaches ?? []).map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.1)' }}
                    onClick={() => setDrawerClientId(c.id)}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: 'var(--text)', maxWidth: 130 }}>{c.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                        Limit: {fmtCurrency(c.creditLimit)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="mono text-xs" style={{ color: 'var(--text-2)' }}>
                        {fmtCurrency(c.outstandingAmount)}
                      </span>
                      <Badge style={{ background: 'rgba(244,63,94,0.15)', color: '#F43F5E', borderColor: 'rgba(244,63,94,0.2)' }}>
                        {c.utilizationPercent}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(data?.creditEnforcement?.recommendCreditHold ?? []).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
                Recommended for Credit Hold
              </p>
              <div className="space-y-1.5">
                {(data.creditEnforcement.recommendCreditHold ?? []).map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.1)' }}
                    onClick={() => setDrawerClientId(c.id)}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: 'var(--text)', maxWidth: 130 }}>{c.name}</p>
                      <PdiBar value={c.paymentDisciplineIndex} color={getPdiColor(c.paymentDisciplineIndex)} />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="mono text-xs" style={{ color: 'var(--red)' }}>
                        {fmtCurrency(c.outstandingAmount)}
                      </span>
                      <Badge className={getRiskBadgeClass(c.riskStatus)}>
                        {getPdiLabel(c.paymentDisciplineIndex)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading &&
            (data?.creditEnforcement?.totalBreaches ?? 0) === 0 &&
            (data?.creditEnforcement?.recommendCreditHold?.length ?? 0) === 0 && (
            <div className="py-6 text-center">
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                No credit enforcement actions required
              </p>
            </div>
          )}
        </div>

        {/* Right column: SLA Monitoring + Collections Performance */}
        <div className="flex flex-col gap-4">

          {/* SLA Monitoring */}
          <div className="card p-5">
            <SectionTitle
              title="SLA Monitoring"
              action={
                <button
                  onClick={() => router.push('/dashboard/sla')}
                  className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
                  style={{ color: 'var(--amber)' }}
                >
                  View breaches <ChevronRight size={12} />
                </button>
              }
            />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div
                className="rounded-lg p-3 cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: 'var(--bg-2)' }}
                onClick={() => router.push('/dashboard/sla')}
              >
                <p
                  className="mono text-2xl font-bold"
                  style={{
                    color: (data?.slaSummary?.unresolvedViolations ?? 0) > 0
                      ? 'var(--red)'
                      : 'var(--green)',
                  }}
                >
                  {isLoading ? '—' : (data?.slaSummary?.unresolvedViolations ?? 0)}
                </p>
                <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-3)' }}>
                  Unresolved Breaches
                </p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-2)' }}>
                <p className="mono text-2xl font-bold" style={{ color: 'var(--amber)' }}>
                  {isLoading ? '—' : `${data?.slaSummary?.averageDaysLate ?? 0}d`}
                </p>
                <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-3)' }}>
                  Avg Days Late
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock size={13} style={{ color: 'var(--amber)', flexShrink: 0 }} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-2)' }}>
                    Follow-up Compliance
                  </span>
                  <span className="mono text-[11px] font-bold" style={{ color: 'var(--text)' }}>
                    {data?.followUpCompliance?.complianceRate ?? 0}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-3)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${data?.followUpCompliance?.complianceRate ?? 0}%`,
                      background: (data?.followUpCompliance?.complianceRate ?? 0) >= 70
                        ? 'var(--green)'
                        : 'var(--amber)',
                    }}
                  />
                </div>
              </div>
              <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                {data?.followUpCompliance?.staleCount ?? 0} stale
              </span>
            </div>
          </div>

          {/* Collections Performance */}
          <div className="card p-5">
            <SectionTitle
              title="Recovery Performance"
              badge={
                <Badge
                  style={{
                    background: (cp?.recoveryRate ?? 0) >= 10
                      ? 'rgba(16,185,129,0.1)'
                      : 'rgba(245,158,11,0.1)',
                    color: (cp?.recoveryRate ?? 0) >= 10
                      ? '#10B981'
                      : 'var(--amber)',
                    borderColor: (cp?.recoveryRate ?? 0) >= 10
                      ? 'rgba(16,185,129,0.2)'
                      : 'rgba(245,158,11,0.2)',
                  }}
                >
                  {cp?.recoveryRate ?? 0}% recovery rate
                </Badge>
              }
            />

            {/* Collected vs Target */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="mono text-xl font-bold" style={{ color: 'var(--green)' }}>
                  {fmtCurrency(cp?.collectedThisWeek ?? 0)}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>collected this week</p>
              </div>
              <div>
                <p className="mono text-xl font-bold" style={{ color: 'var(--amber)' }}>
                  {fmtCurrency(cp?.weeklyTarget ?? 0)}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>weekly target</p>
              </div>
            </div>

            {/* Target progress bar */}
            {(cp?.weeklyTarget ?? 0) > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>Target progress</span>
                  <span className="mono text-[10px] font-bold" style={{ color: 'var(--text-2)' }}>
                    {Math.min(100, Math.round(((cp?.collectedThisWeek ?? 0) / (cp?.weeklyTarget ?? 1)) * 100))}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-3)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round(((cp?.collectedThisWeek ?? 0) / (cp?.weeklyTarget ?? 1)) * 100))}%`,
                      background: 'var(--green)',
                    }}
                  />
                </div>
                {(cp?.recoveryGap ?? 0) > 0 && (
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>
                    Recovery gap:{' '}
                    <span className="mono font-semibold" style={{ color: '#F97316' }}>
                      {fmtCurrency(cp?.recoveryGap ?? 0)}
                    </span>
                    {' '}· Expected recoverable:{' '}
                    <span className="mono font-semibold" style={{ color: 'var(--text-2)' }}>
                      {fmtCurrency(cp?.expectedRecoverable ?? 0)}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Weekly trend bars */}
            <div className="flex items-end gap-2" style={{ height: 44 }}>
              {weeklyTrend.length === 0
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex-1 rounded-t" style={{ height: 4, background: 'var(--bg-3)', alignSelf: 'flex-end' }} />
                  ))
                : weeklyTrend.map((w, i) => {
                    const barH = Math.max(4, Math.round((w.collected / maxCollected) * 40));
                    const isLatest = i === weeklyTrend.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
                        <div
                          className="w-full rounded-t transition-all"
                          style={{ height: barH, background: isLatest ? 'var(--green)' : 'var(--bg-3)' }}
                          title={`${w.week}: ${fmtCurrency(w.collected)}`}
                        />
                        <span className="text-[9px] leading-none" style={{ color: 'var(--text-3)' }}>{w.week}</span>
                      </div>
                    );
                  })}
            </div>
          </div>

        </div>
      </div>

    </div>

    {/* Drawers */}
    <ClientDrawer
      clientId={drawerClientId}
      onClose={() => setDrawerClientId(null)}
      onViewInvoice={id => { setDrawerClientId(null); setDrawerInvoiceId(id); }}
    />
    <InvoiceDrawer
      invoiceId={drawerInvoiceId}
      onClose={() => setDrawerInvoiceId(null)}
    />
    </>
  );
}
