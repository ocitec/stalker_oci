'use client';

import { useRouter } from 'next/navigation';
import { Clock, ChevronRight, Phone } from 'lucide-react';
import { useDashboard } from '@/lib/hooks/useApi';
import { KpiCard, SkeletonCard, SectionTitle, Badge, PdiBar, EmptyState } from '@/components/ui';
import {
  fmtCurrency, getPdiColor, getPdiLabel,
  getRiskBadgeClass, getFollowUpColor,
} from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useDashboard();

  const weeklyTrend: { week: string; collected: number }[] =
    data?.collectionsPerformance?.weeklyTrend ?? [];
  const maxCollected = Math.max(...weeklyTrend.map(w => w.collected), 1);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Cash at Risk ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : data ? (
          <>
            <KpiCard
              label="Total Outstanding"
              value={fmtCurrency(data.kpis.totalOutstanding)}
              sub={`${(data.kpis.overdueCount ?? 0) + (data.kpis.dueTodayCount ?? 0)} invoices need attention`}
              accent="var(--amber)"
            />
            <KpiCard
              label="Total Overdue"
              value={fmtCurrency(data.kpis.overdueValue)}
              trendLabel={`${data.kpis.overdueCount} overdue invoices`}
              trend="up"
              accent="var(--red)"
            />
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
            <KpiCard
              label="Due Today"
              value={data.kpis.dueTodayCount}
              sub={`${data.kpis.chronicClients} chronic · ${data.kpis.blockedClients} blocked`}
              accent={data.kpis.dueTodayCount > 0 ? 'var(--amber)' : 'var(--text)'}
            />
          </>
        ) : null}
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
                onClick={() => router.push('/dashboard/followups')}
                className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--amber)' }}
              >
                Log follow-up <ChevronRight size={12} />
              </button>
            }
          />
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-14 w-full rounded-lg" />
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
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                  style={{
                    background: 'var(--bg-2)',
                    borderLeft: `3px solid ${getPdiColor(c.paymentDisciplineIndex)}`,
                  }}
                  onClick={() => router.push('/dashboard/followups')}
                >
                  <span
                    className="text-xs font-bold w-5 flex-shrink-0 text-center"
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
                      onClick={() => router.push('/dashboard/invoices')}
                    >
                      <td className="py-2.5 mono font-medium" style={{ color: 'var(--text-2)' }}>
                        {inv.invoiceNumber}
                      </td>
                      <td
                        className="py-2.5 font-medium"
                        style={{ color: 'var(--text)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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

          {/* Summary counters */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)' }}
            >
              <p className="mono text-2xl font-bold" style={{ color: 'var(--red)' }}>
                {isLoading ? '—' : (data?.creditEnforcement?.totalBreaches ?? 0)}
              </p>
              <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-3)' }}>
                Limit Breaches
              </p>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}
            >
              <p className="mono text-2xl font-bold" style={{ color: 'var(--amber)' }}>
                {isLoading ? '—' : (data?.creditEnforcement?.totalNearLimit ?? 0)}
              </p>
              <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-3)' }}>
                Near Limit ≥80%
              </p>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}
            >
              <p className="mono text-2xl font-bold" style={{ color: '#F97316' }}>
                {isLoading ? '—' : (data?.creditEnforcement?.recommendCreditHold?.length ?? 0)}
              </p>
              <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-3)' }}>
                Recommend Hold
              </p>
            </div>
          </div>

          {/* Breaches list */}
          {(data?.creditEnforcement?.breaches ?? []).length > 0 && (
            <div className="mb-3">
              <p
                className="text-[10px] uppercase tracking-wide font-semibold mb-2"
                style={{ color: 'var(--text-3)' }}
              >
                Credit Limit Breached
              </p>
              <div className="space-y-1.5">
                {(data.creditEnforcement.breaches ?? []).map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-lg"
                    style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.1)' }}
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

          {/* Recommended for credit hold */}
          {(data?.creditEnforcement?.recommendCreditHold ?? []).length > 0 && (
            <div>
              <p
                className="text-[10px] uppercase tracking-wide font-semibold mb-2"
                style={{ color: 'var(--text-3)' }}
              >
                Recommended for Credit Hold
              </p>
              <div className="space-y-1.5">
                {(data.creditEnforcement.recommendCreditHold ?? []).map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-lg"
                    style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.1)' }}
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
                  View all <ChevronRight size={12} />
                </button>
              }
            />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-2)' }}>
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

            {/* Follow-up compliance inline */}
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
              title="Collections This Week"
              badge={
                <Badge
                  style={{
                    background: (data?.collectionsPerformance?.recoveryRate ?? 0) >= 10
                      ? 'rgba(16,185,129,0.1)'
                      : 'rgba(245,158,11,0.1)',
                    color: (data?.collectionsPerformance?.recoveryRate ?? 0) >= 10
                      ? '#10B981'
                      : 'var(--amber)',
                    borderColor: (data?.collectionsPerformance?.recoveryRate ?? 0) >= 10
                      ? 'rgba(16,185,129,0.2)'
                      : 'rgba(245,158,11,0.2)',
                  }}
                >
                  {data?.collectionsPerformance?.recoveryRate ?? 0}% recovery rate
                </Badge>
              }
            />

            <div className="mb-4">
              <p className="mono text-2xl font-bold" style={{ color: 'var(--green)' }}>
                {fmtCurrency(data?.collectionsPerformance?.collectedThisWeek ?? 0)}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                recovered this week ·{' '}
                {fmtCurrency(data?.collectionsPerformance?.totalOverdue ?? 0)} still overdue
              </p>
            </div>

            {/* Weekly trend: inline mini bars */}
            <div className="flex items-end gap-2" style={{ height: 48 }}>
              {weeklyTrend.length === 0
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{ height: 4, background: 'var(--bg-3)', alignSelf: 'flex-end' }}
                    />
                  ))
                : weeklyTrend.map((w, i) => {
                    const barH = Math.max(4, Math.round((w.collected / maxCollected) * 44));
                    const isLatest = i === weeklyTrend.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
                        <div
                          className="w-full rounded-t transition-all"
                          style={{
                            height: barH,
                            background: isLatest ? 'var(--green)' : 'var(--bg-3)',
                          }}
                          title={`${w.week}: ${fmtCurrency(w.collected)}`}
                        />
                        <span className="text-[9px] leading-none" style={{ color: 'var(--text-3)' }}>
                          {w.week}
                        </span>
                      </div>
                    );
                  })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
