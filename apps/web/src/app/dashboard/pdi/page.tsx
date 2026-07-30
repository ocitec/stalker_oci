'use client';

import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { usePdiRanking } from '@/lib/hooks/useApi';
import { SectionTitle, Badge, SkeletonTable, PdiBar, ProgressRing } from '@/components/ui';
import { getPdiColor, getPdiLabel, getRiskBadgeClass, fmtCurrency } from '@/lib/utils';
import type { Client } from '@/types';

const DIST_CONFIG = [
  { key: 'RELIABLE',  label: 'Reliable',   range: '80–100', color: '#10B981' },
  { key: 'MODERATE',  label: 'Moderate',   range: '60–79',  color: '#3B82F6' },
  { key: 'HIGH_RISK', label: 'High Risk',  range: '40–59',  color: '#F59E0B' },
  { key: 'CHRONIC',   label: 'Chronic',    range: '<40',    color: '#F43F5E' },
];

export default function PdiPage() {
  const { data: clients, isLoading } = usePdiRanking();

  const distCounts = DIST_CONFIG.map(d => ({
    ...d,
    count: clients?.filter((c: Client) => c.riskStatus === d.key).length ?? 0,
  }));

  const totalClients = clients?.length ?? 0;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Distribution Cards */}
      <div className="stat-grid">
        {distCounts.map(d => (
          <div key={d.key} className="card p-4 flex items-center gap-4">
            <ProgressRing value={totalClients > 0 ? Math.round((d.count / totalClients) * 100) : 0} size={52} color={d.color} />
            <div>
              <p className="mono text-2xl font-black" style={{ color: d.color }}>{d.count}</p>
              <p className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{d.label}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>PDI {d.range}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Bar chart */}
        <div className="card p-5">
          <SectionTitle title="PDI Score Distribution" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={(clients ?? []).slice(0, 10).map((c: Client) => ({
                name: c.name.split(' ').slice(0,2).join(' '),
                pdi: Math.round(Number(c.paymentDisciplineIndex)),
                color: getPdiColor(Number(c.paymentDisciplineIndex)),
              }))}
              layout="vertical"
              barSize={14}
            >
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#5A6E96', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#8B9DC3', fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip
                contentStyle={{ background: '#1A2236', border: '1px solid #2A3A5C', borderRadius: 8, color: '#E8EDF8', fontSize: 12 }}
                formatter={(v: any) => [v, 'PDI']}
              />
              <Bar dataKey="pdi" radius={[0, 4, 4, 0]}>
                {(clients ?? []).slice(0, 10).map((c: Client, i: number) => (
                  <Cell key={i} fill={getPdiColor(Number(c.paymentDisciplineIndex))} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* League Table */}
        <div className="card p-5">
          <SectionTitle title="PDI League Table" />
          {isLoading ? <SkeletonTable rows={8} /> : (
            <div className="space-y-0 overflow-y-auto max-h-64">
              {(clients ?? []).map((c: Client, i: number) => {
                const pdi = Math.round(Number(c.paymentDisciplineIndex));
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 py-2.5 border-b"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span className="text-[11px] w-6 text-right flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{c.name}</p>
                      <div className="mt-1 h-1 rounded-full w-full" style={{ background: 'var(--bg-3)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pdi}%`, background: getPdiColor(pdi) }} />
                      </div>
                    </div>
                    <span className="mono text-base font-black w-8 text-right flex-shrink-0" style={{ color: getPdiColor(pdi) }}>{pdi}</span>
                    <Badge className={getRiskBadgeClass(c.riskStatus)} style={{ fontSize: '9px' }}>
                      {getPdiLabel(pdi)}
                    </Badge>
                    {c.isBlocked && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>
                        BLOCKED
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
