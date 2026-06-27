'use client';

import { cn } from '@/lib/utils';

// ── KPI Card ───────────────────────────────────
interface KpiCardDelta {
  pct: number;
  label?: string;
  /** When true, a positive pct is good (e.g. collection efficiency up). Default: positive = bad. */
  inverted?: boolean;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  accent?: string;
  loading?: boolean;
  delta?: KpiCardDelta;
}

export function KpiCard({ label, value, sub, trend, trendLabel, accent, loading, delta }: KpiCardProps) {
  if (loading) return <SkeletonCard />;

  let deltaColor = '#5A6E96';
  if (delta && delta.pct !== 0) {
    const isGood = delta.inverted ? delta.pct > 0 : delta.pct < 0;
    deltaColor = isGood ? '#10B981' : '#F43F5E';
  }

  return (
    <div className="card p-4 transition-all cursor-default">
      <p className="text-[11px] uppercase tracking-widest mb-1.5 font-medium" style={{ color: 'var(--text-3)' }}>
        {label}
      </p>
      <p className="mono text-2xl font-bold leading-none tracking-tight" style={{ color: accent || 'var(--text)' }}>
        {value}
      </p>
      {delta && (
        <p className="mono text-[11px] mt-1.5 flex items-center gap-0.5 font-semibold" style={{ color: deltaColor }}>
          {delta.pct > 0 ? '↑' : delta.pct < 0 ? '↓' : '→'}{' '}
          {Math.abs(delta.pct)}%{' '}
          <span className="font-normal" style={{ color: 'var(--text-3)' }}>{delta.label ?? 'vs last month'}</span>
        </p>
      )}
      {!delta && (sub || trendLabel) && (
        <p className={cn('text-[11px] mt-1.5 flex items-center gap-1',
          trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-emerald-400' : ''
        )} style={{ color: !trend ? 'var(--text-3)' : undefined }}>
          {trend === 'up' && '↑'}
          {trend === 'down' && '↓'}
          {trendLabel || sub}
        </p>
      )}
    </div>
  );
}

// ── Skeleton Card ──────────────────────────────
export function SkeletonCard() {
  return (
    <div className="card p-4">
      <div className="skeleton h-3 w-24 mb-3" />
      <div className="skeleton h-7 w-32 mb-2" />
      <div className="skeleton h-2.5 w-20" />
    </div>
  );
}

// ── Skeleton Table ─────────────────────────────
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="skeleton h-4 flex-1" />
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// ── Status Badge ───────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({ children, className, style }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border border-transparent', className)}
      style={style}
    >
      {children}
    </span>
  );
}

// ── Section Title ──────────────────────────────
interface SectionTitleProps {
  title: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
}

export function SectionTitle({ title, action, badge }: SectionTitleProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>{title}</h2>
        {badge}
      </div>
      {action}
    </div>
  );
}

// ── PDI Bar ────────────────────────────────────
export function PdiBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="mono text-sm font-bold w-8" style={{ color }}>{value}</span>
      <div className="h-1.5 w-16 rounded-full" style={{ background: 'var(--bg-3)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Progress Ring ──────────────────────────────
export function ProgressRing({ value, size = 56, stroke = 5, color }: {
  value: number; size?: number; stroke?: number; color: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

// ── Ghost Button ───────────────────────────────
export function GhostButton({ children, onClick, className, disabled }: {
  children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
        'hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed',
        className,
      )}
      style={{
        background: 'transparent',
        borderColor: 'var(--border)',
        color: 'var(--text-2)',
      }}
    >
      {children}
    </button>
  );
}

// ── Amber Button ───────────────────────────────
export function AmberButton({ children, onClick, className, disabled }: {
  children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-4 py-2 rounded-lg text-xs font-bold transition-all',
        'hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed',
        className,
      )}
      style={{ background: 'var(--indigo)', color: '#fff' }}
    >
      {children}
    </button>
  );
}

// ── Empty State ────────────────────────────────
export function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div style={{ color: 'var(--text-3)' }}>{icon}</div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{title}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--text-3)' }}>{sub}</p>}
    </div>
  );
}
