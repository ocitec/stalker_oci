import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ClientRisk, InvoiceStatus, ColorCode } from '@/types';

// ── Class merging ──────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Currency formatting ────────────────────────
export function fmtCurrency(value: number, currency = 'NGN'): string {
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `₦${(value / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency, minimumFractionDigits: 0,
  }).format(value);
}

export function fmtCurrencyFull(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
  }).format(value);
}

// ── Date formatting ────────────────────────────
export function fmtDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateStr));
}

export function fmtDateShort(dateStr: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(dateStr));
}

export function fmtRelative(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  if (diff < 30)  return `${diff} days ago`;
  if (diff < 365) return `${Math.floor(diff / 30)} months ago`;
  return `${Math.floor(diff / 365)} years ago`;
}

// ── PDI helpers ────────────────────────────────
export function getPdiColor(pdi: number): string {
  if (pdi >= 80) return '#10B981';
  if (pdi >= 60) return '#3B82F6';
  if (pdi >= 40) return '#F59E0B';
  return '#F43F5E';
}

export function getPdiLabel(pdi: number): string {
  if (pdi >= 80) return 'Reliable';
  if (pdi >= 60) return 'Moderate Risk';
  if (pdi >= 40) return 'High Risk';
  return 'Chronic';
}

export function getRiskBadgeClass(risk: ClientRisk): string {
  const map: Record<ClientRisk, string> = {
    RELIABLE:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    MODERATE:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
    HIGH_RISK: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    CHRONIC:   'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return map[risk];
}

// ── Invoice status helpers ─────────────────────
export function getStatusClass(status: InvoiceStatus): string {
  const map: Record<InvoiceStatus, string> = {
    OVERDUE:    'status-overdue',
    DUE_TODAY:  'status-due-today',
    PENDING:    'status-approaching',
    PAID:       'status-paid',
    CANCELLED:  'status-paid',
  };
  return map[status] ?? 'status-paid';
}

export function getStatusLabel(status: InvoiceStatus): string {
  const map: Record<InvoiceStatus, string> = {
    OVERDUE:    'OVERDUE',
    DUE_TODAY:  'DUE TODAY',
    PENDING:    'PENDING',
    PAID:       'PAID',
    CANCELLED:  'CANCELLED',
  };
  return map[status] ?? status;
}

export function getColorCodeStyle(code: ColorCode): string {
  const map: Record<ColorCode, string> = {
    red:    'text-red-400',
    amber:  'text-amber-400',
    blue:   'text-blue-400',
    green:  'text-emerald-400',
  };
  return map[code] ?? '';
}

// ── Follow-up clock colour ─────────────────────
export function getFollowUpColor(days: number): string {
  if (days > 7)  return '#F43F5E';
  if (days > 3)  return '#F59E0B';
  return '#10B981';
}

// ── Number helpers ─────────────────────────────
export function fmtNumber(n: number): string {
  return new Intl.NumberFormat('en').format(Math.round(n));
}

export function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}
