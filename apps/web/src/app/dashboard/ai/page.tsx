'use client';

import { useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  Sparkles, TrendingDown, AlertCircle, CheckCircle2,
  RefreshCw, Search, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAiInsights, usePredictiveRisk, useSectorAnalysis, useCfoReport } from '@/lib/hooks/useApi';
import { SectionTitle, Badge, SkeletonCard, GhostButton } from '@/components/ui';
import { getPdiColor, fmtCurrency } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { QK } from '@/lib/hooks/useApi';
import { toast } from 'sonner';

const PAGE_SIZE = 8;

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  critical: { color: '#F43F5E', bg: 'rgba(244,63,94,0.08)',  border: '#F43F5E', icon: <AlertCircle size={14} /> },
  warning:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: '#F59E0B', icon: <TrendingDown size={14} /> },
  info:     { color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: '#3B82F6', icon: <Sparkles size={14} /> },
  positive: { color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: '#10B981', icon: <CheckCircle2 size={14} /> },
};

// ── Custom tooltip — all text explicitly white ───────────────────────────────
function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{
      background: '#1A2236', border: '1px solid #2A3A5C',
      borderRadius: 8, padding: '10px 14px', fontSize: 11,
    }}>
      <p style={{ color: '#E8EDF8', fontWeight: 700, marginBottom: 6 }}>{d.name}</p>
      <p style={{ color: '#8B9DC3' }}>Late Probability: <span style={{ color: '#E8EDF8', fontFamily: 'monospace' }}>{d.x}%</span></p>
      <p style={{ color: '#8B9DC3' }}>Expected Delay:   <span style={{ color: '#E8EDF8', fontFamily: 'monospace' }}>{d.y}d</span></p>
      <p style={{ color: '#8B9DC3' }}>PDI Score:        <span style={{ fontFamily: 'monospace', color: getPdiColor(d.pdi) }}>{d.pdi}</span></p>
    </div>
  );
}

export default function AiPage() {
  const qc = useQueryClient();

  const { data: insightsData, isLoading: insightsLoading } = useAiInsights();
  const { data: riskData,     isLoading: riskLoading }     = usePredictiveRisk();
  const { data: sectorData }                               = useSectorAnalysis();
  const { data: cfoReport }                                = useCfoReport();

  // ── Forecast table state ───────────────────────────────────────────────────
  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(1);
  const [feedback,  setFeedback]  = useState<Record<string, 'up' | 'down'>>({});

  const insights = insightsData?.insights ?? [];
  const allRisks = riskData ?? [];

  // Filter + paginate
  const filtered = allRisks.filter((r: any) =>
    !search || r.clientName?.toLowerCase().includes(search.toLowerCase()) ||
    r.sector?.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRisks  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const scatterData = allRisks.map((r: any) => ({
    x:    r.latePaymentProbability,
    y:    r.expectedDelayDays,
    name: r.clientName,
    pdi:  r.pdi,
  }));

  function handleFeedback(clientId: string, vote: 'up' | 'down') {
    setFeedback(prev => ({ ...prev, [clientId]: vote }));
    toast.success(vote === 'up'
      ? 'Thanks — forecast marked as accurate'
      : 'Feedback noted — forecast marked for review');
  }

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: 'var(--amber)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AI Analytics Engine</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--amber)' }}>
            Rule-based · Connect OpenAI to enable LLM
          </span>
        </div>
        <GhostButton onClick={() => qc.invalidateQueries({ queryKey: QK.insights })}>
          <RefreshCw size={11} className="inline mr-1" />Refresh
        </GhostButton>
      </div>

      <div className="grid grid-cols-3 gap-5">

        {/* Left: Insights + CFO summary */}
        <div className="col-span-1 space-y-3">
          <SectionTitle title="Behavioral Insights" />
          {insightsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          ) : insights.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>No insights generated yet</p>
            </div>
          ) : insights.map((ins: any, i: number) => {
            const cfg = SEVERITY_CONFIG[ins.severity] ?? SEVERITY_CONFIG.info;
            return (
              <div key={i} className="card p-4 border-l-2" style={{ borderLeftColor: cfg.border }}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cfg.color }}>
                    {ins.type?.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text)' }}>{ins.title}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{ins.body}</p>
              </div>
            );
          })}

          {/* CFO Weekly Summary */}
          {cfoReport && (
            <div className="card p-4">
              <SectionTitle title="Weekly CFO Summary" />
              <div className="space-y-0">
                {[
                  { label: 'Collected this week',   value: fmtCurrency(cfoReport.kpis?.collectedThisWeek ?? 0), color: 'var(--green)' },
                  { label: 'New overdue invoices',   value: cfoReport.kpis?.newOverdueInvoices ?? 0,           color: 'var(--red)' },
                  { label: 'Follow-ups logged',      value: cfoReport.kpis?.followUpsLogged    ?? 0,           color: 'var(--amber)' },
                  { label: 'New SLA violations',     value: cfoReport.newSlaViolations          ?? 0,           color: 'var(--amber)' },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between py-2 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
                    <span style={{ color: 'var(--text-2)' }}>{m.label}</span>
                    <span className="mono font-bold" style={{ color: m.color }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Scatter + Forecast Table */}
        <div className="col-span-2 space-y-5">

          {/* Scatter chart — FIX: custom tooltip with white text */}
          <div className="card p-5">
            <SectionTitle title="Late Payment Probability Matrix" />
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ bottom: 20 }}>
                <XAxis
                  dataKey="x" name="Late Probability" type="number" domain={[0, 100]}
                  tick={{ fill: '#8B9DC3', fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  label={{ value: 'Late Payment Probability (%)', position: 'insideBottom', offset: -12, fill: '#5A6E96', fontSize: 10 }}
                />
                <YAxis
                  dataKey="y" name="Expected Delay" type="number"
                  tick={{ fill: '#8B9DC3', fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  label={{ value: 'Expected Delay (d)', angle: -90, position: 'insideLeft', fill: '#5A6E96', fontSize: 10 }}
                />
                {/* FIX: replaced default Tooltip with custom component so text is always #E8EDF8 */}
                <Tooltip content={<ScatterTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Scatter data={scatterData} shape="circle">
                  {scatterData.map((d: any, i: number) => (
                    <Cell key={i} fill={getPdiColor(d.pdi)} fillOpacity={0.8} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast Table — paginated + searchable + feedback */}
          <div className="card overflow-hidden">
            {/* Table header + search */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--text)' }}>
                Payment Probability Forecast
                <span className="mono font-normal text-[11px] ml-2" style={{ color: 'var(--text-3)' }}>
                  {filtered.length} clients
                </span>
              </h2>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
                <input
                  className="pl-7 pr-3 py-1.5 rounded-lg text-xs outline-none w-44"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  placeholder="Search client or sector…"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                />
              </div>
            </div>

            {riskLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-8" />)}
              </div>
            ) : pageRisks.length === 0 ? (
              <div className="p-8 text-center text-xs" style={{ color: 'var(--text-3)' }}>
                No results for "{search}"
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Client','Sector','PDI','Late Prob.','Exp. Delay','Risk Score','Recommendation','Feedback'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRisks.map((r: any) => {
                    const probColor  = r.latePaymentProbability > 70 ? '#F43F5E' : r.latePaymentProbability > 40 ? '#F59E0B' : '#10B981';
                    const scoreColor = r.riskScore > 70 ? '#F43F5E' : r.riskScore > 40 ? '#F59E0B' : '#10B981';
                    const fb         = feedback[r.clientId];
                    return (
                      <tr key={r.clientId} className="border-b hover:opacity-90 transition-colors" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--text)' }}>{r.clientName}</td>
                        <td className="px-3 py-2.5" style={{ color: 'var(--text-3)' }}>{r.sector ?? '—'}</td>
                        <td className="px-3 py-2.5 mono font-bold" style={{ color: getPdiColor(r.pdi) }}>{r.pdi}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-14 rounded-full" style={{ background: 'var(--bg-3)' }}>
                              <div className="h-full rounded-full" style={{ width: `${r.latePaymentProbability}%`, background: probColor }} />
                            </div>
                            <span className="mono font-bold text-[11px]" style={{ color: probColor }}>{r.latePaymentProbability}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 mono" style={{ color: 'var(--text-2)' }}>{r.expectedDelayDays}d</td>
                        <td className="px-3 py-2.5">
                          <span className="mono text-sm font-black" style={{ color: scoreColor }}>{r.riskScore}</span>
                          <span className="text-[10px] ml-0.5" style={{ color: 'var(--text-3)' }}>/100</span>
                        </td>
                        <td className="px-3 py-2.5 max-w-[160px]">
                          <span className="text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                            {r.recommendation}
                          </span>
                        </td>
                        {/* Feedback column */}
                        <td className="px-3 py-2.5">
                          {fb ? (
                            <span className="text-[10px]" style={{ color: fb === 'up' ? '#10B981' : '#F43F5E' }}>
                              {fb === 'up' ? '✓ Accurate' : '✗ Inaccurate'}
                            </span>
                          ) : (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleFeedback(r.clientId, 'up')}
                                className="p-1 rounded hover:opacity-70 transition-all"
                                style={{ color: '#10B981' }}
                                title="Forecast is accurate"
                              >
                                <ThumbsUp size={11} />
                              </button>
                              <button
                                onClick={() => handleFeedback(r.clientId, 'down')}
                                className="p-1 rounded hover:opacity-70 transition-all"
                                style={{ color: '#F43F5E' }}
                                title="Forecast is inaccurate"
                              >
                                <ThumbsDown size={11} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-xs" style={{ borderColor: 'var(--border)' }}>
                <span style={{ color: 'var(--text-3)' }}>
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg hover:opacity-70 transition-all disabled:opacity-30"
                    style={{ background: 'var(--bg-2)', color: 'var(--text-2)' }}
                  >
                    <ChevronLeft size={13} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="w-6 h-6 rounded-lg text-[11px] font-medium transition-all"
                      style={{
                        background: page === p ? 'var(--amber)' : 'var(--bg-2)',
                        color:      page === p ? '#000'          : 'var(--text-2)',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:opacity-70 transition-all disabled:opacity-30"
                    style={{ background: 'var(--bg-2)', color: 'var(--text-2)' }}
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}