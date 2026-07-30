'use client';

import { cn } from '@/lib/utils';
import { X, AlertCircle, Inbox } from 'lucide-react';

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
export function EmptyState({ icon, title, sub, action }: { icon: React.ReactNode; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 sm:py-16 gap-3 px-6 text-center">
      <div style={{ color: 'var(--text-3)' }}>{icon}</div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{title}</p>
      {sub && <p className="text-xs max-w-xs" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

// ── Error State ────────────────────────────────
export function ErrorState({ title = 'Something went wrong', sub, onRetry }: { title?: string; sub?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 sm:py-16 gap-3 px-6 text-center">
      <div style={{ color: 'var(--red)' }}><AlertCircle size={30} /></div>
      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</p>
      {sub && <p className="text-xs max-w-xs" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      {onRetry && <button className="btn btn-ghost" onClick={onRetry}>Try again</button>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Mobile-first shared primitives
// ═══════════════════════════════════════════════════════════════════════════

// ── Button (variant-based, touch-friendly) ─────
type BtnVariant = 'primary' | 'ghost' | 'danger' | 'success';
export function Button({
  children, onClick, variant = 'primary', type = 'button', disabled, block, blockMobile, className, title,
}: {
  children: React.ReactNode; onClick?: () => void; variant?: BtnVariant;
  type?: 'button' | 'submit'; disabled?: boolean; block?: boolean; blockMobile?: boolean;
  className?: string; title?: string;
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} title={title}
      className={cn('btn', `btn-${variant}`, block && 'btn-block', blockMobile && 'btn-block-mobile', className)}
    >
      {children}
    </button>
  );
}

// ── Page Header ────────────────────────────────
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

// ── Toolbar (search / filters / actions) ───────
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('toolbar', className)}>{children}</div>;
}

// ── Stat Grid ──────────────────────────────────
export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 }) {
  return <div className={cn('stat-grid', cols === 3 && 'stat-grid--3')}>{children}</div>;
}

// ── Status Pill ────────────────────────────────
export function StatusPill({ label, tone = 'neutral' }: {
  label: string; tone?: 'green' | 'amber' | 'red' | 'blue' | 'neutral';
}) {
  const map: Record<string, { bg: string; color: string }> = {
    green:   { bg: 'rgba(34,197,94,0.12)',  color: 'var(--green)' },
    amber:   { bg: 'rgba(245,158,11,0.12)', color: 'var(--amber)' },
    red:     { bg: 'rgba(239,68,68,0.12)',  color: 'var(--red)' },
    blue:    { bg: 'rgba(99,102,241,0.14)', color: 'var(--indigo-2)' },
    neutral: { bg: 'rgba(90,110,150,0.15)', color: 'var(--text-3)' },
  };
  const s = map[tone] ?? map.neutral;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide" style={{ background: s.bg, color: s.color }}>
      {label}
    </span>
  );
}

// ── Field (label + control + error) ────────────
export function Field({ label, error, hint, children }: { label?: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      {label && <label className="form-label">{label}</label>}
      {children}
      {hint && !error && <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>{hint}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

// ── Dialog (matches NewInvoiceModal chrome: centered card, sticky header/footer) ──
export function Dialog({ open, onClose, title, subtitle, icon, children, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  icon?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="animate-scale-in w-full max-w-lg rounded-xl" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            {icon && <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--indigo-2)' }}>{icon}</div>}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{title}</h2>
              {subtitle && <p className="text-[10px] truncate" style={{ color: 'var(--text-3)' }}>{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 hover:opacity-70" style={{ background: 'var(--bg-3)', color: 'var(--text-2)' }} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5 space-y-4">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-between gap-2 px-6 py-4 sticky bottom-0" style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Confirm Dialog ─────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'primary', loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string;
  confirmLabel?: string; tone?: BtnVariant; loading?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={tone} onClick={onConfirm} disabled={loading}>{loading ? 'Working…' : confirmLabel}</Button>
      </>}>
      <p className="text-sm" style={{ color: 'var(--text-2)' }}>{message}</p>
    </Dialog>
  );
}

// ── Pagination (shared across every list table) ──
export function Pagination({ page, totalPages, total, pageSize, onPage, label = 'items' }: {
  page: number; totalPages: number; total: number; pageSize: number; onPage: (p: number) => void; label?: string;
}) {
  if (!totalPages || totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);
  const nums: number[] = [];
  const from = Math.max(1, Math.min(totalPages - 4, page - 2));
  for (let i = 0; i < Math.min(5, totalPages); i++) { const pg = from + i; if (pg <= totalPages) nums.push(pg); }
  return (
    <div className="flex items-center justify-between mt-4 text-xs flex-wrap gap-2">
      <span style={{ color: 'var(--text-3)' }}>{start}–{end} of {total} {label}</span>
      <div className="flex items-center gap-1">
        <GhostButton onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}>← Prev</GhostButton>
        <div className="hidden sm:flex items-center gap-1">
          {nums.map(pg => (
            <button key={pg} onClick={() => onPage(pg)} className="w-8 h-8 rounded text-[11px] font-medium transition-all"
              style={{ background: pg === page ? 'var(--indigo)' : 'transparent', color: pg === page ? '#fff' : 'var(--text-3)' }}>{pg}</button>
          ))}
        </div>
        <span className="sm:hidden mono text-[11px] px-1" style={{ color: 'var(--text-3)' }}>{page}/{totalPages}</span>
        <GhostButton onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Next →</GhostButton>
      </div>
    </div>
  );
}

// ── Responsive Table (table ≥md, stacked cards on mobile) ──
export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
  hideOnMobile?: boolean;
  primary?: boolean;      // used as the mobile card's title
}

export function ResponsiveTable<T extends Record<string, any>>({
  columns, rows, loading, empty, onRowClick, keyField = 'id', rowActions,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  keyField?: string;
  rowActions?: (row: T) => React.ReactNode;
}) {
  if (loading) return <SkeletonTable rows={6} />;
  if (!rows.length) return <>{empty ?? <EmptyState icon={<Inbox size={30} />} title="Nothing to show" />}</>;

  const cell = (col: Column<T>, row: T) => (col.render ? col.render(row) : (row[col.key] ?? '—'));
  const primary = columns.find(c => c.primary) ?? columns[0];

  return (
    <>
      {/* Desktop table */}
      <div className="only-desktop card table-wrap">
        <table className="w-full text-xs" style={{ minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {columns.map(c => (
                <th key={c.key} className={cn('px-4 py-3 font-medium uppercase tracking-wide text-[10px] whitespace-nowrap', c.align === 'right' ? 'text-right' : 'text-left')} style={{ color: 'var(--text-3)' }}>
                  {c.header}
                </th>
              ))}
              {rowActions && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row[keyField] ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('border-b transition-colors', onRowClick && 'cursor-pointer hover:opacity-90')}
                style={{ borderColor: 'var(--border)' }}>
                {columns.map(c => (
                  <td key={c.key} className={cn('px-4 py-3 whitespace-nowrap', c.align === 'right' ? 'text-right' : 'text-left')} style={{ color: 'var(--text-2)' }}>
                    {cell(c, row)}
                  </td>
                ))}
                {rowActions && <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>{rowActions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="only-mobile flex flex-col gap-2.5">
        {rows.map((row, i) => (
          <div key={row[keyField] ?? i}
            className="data-card"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            role={onRowClick ? 'button' : undefined}>
            <div className="data-card__row">
              <div className="font-semibold text-sm min-w-0 truncate" style={{ color: 'var(--text)' }}>{cell(primary, row)}</div>
              {rowActions && <div onClick={e => e.stopPropagation()}>{rowActions(row)}</div>}
            </div>
            {columns.filter(c => c !== primary && !c.hideOnMobile).map(c => (
              <div key={c.key} className="data-card__row">
                <span className="data-card__label">{c.header}</span>
                <span className="data-card__value">{cell(c, row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
