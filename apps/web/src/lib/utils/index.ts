import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { InvoiceStatus, ClientRisk } from '@/types';

// ── Tailwind class merger ──────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Currency ──────────────────────────────────────────────────────────────
export function fmtCurrency(
  value: number | string,
  currency = 'NGN',
): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('en-NG', {
    style:                 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

// ── Dates ─────────────────────────────────────────────────────────────────
export function fmtDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return format(d, 'd MMM yyyy');
  } catch {
    return '—';
  }
}

export function fmtDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return format(d, 'd MMM yyyy, HH:mm');
  } catch {
    return '—';
  }
}

export function fmtRelative(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '—';
  }
}

// ── Invoice status helpers ─────────────────────────────────────────────────
// getStatusClass returns a CSS class defined in globals.css.
// getStatusLabel returns the human-readable label shown in badges.
// Both include PARTIALLY_PAID.

export function getStatusClass(status: string): string {
  switch (status) {
    case 'PAID':           return 'status-paid';
    case 'PARTIALLY_PAID': return 'status-partial';
    case 'OVERDUE':        return 'status-overdue';
    case 'DUE_TODAY':      return 'status-due-today';
    case 'PENDING':        return 'status-clear';
    case 'CANCELLED':      return 'status-cancelled';
    default:               return 'status-clear';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'PAID':           return 'Paid';
    case 'PARTIALLY_PAID': return 'Partial';
    case 'OVERDUE':        return 'Overdue';
    case 'DUE_TODAY':      return 'Due Today';
    case 'PENDING':        return 'Pending';
    case 'CANCELLED':      return 'Cancelled';
    default:               return status;
  }
}

// Returns the semantic accent color for each invoice status
export function getStatusColor(status: string): string {
  switch (status) {
    case 'PAID':           return '#10B981';  // green
    case 'PARTIALLY_PAID': return '#3B82F6';  // blue — in progress
    case 'OVERDUE':        return '#F43F5E';  // red
    case 'DUE_TODAY':      return '#F59E0B';  // amber
    case 'PENDING':        return '#5A6E96';  // muted
    case 'CANCELLED':      return '#5A6E96';  // muted
    default:               return '#5A6E96';
  }
}

// Returns true for any status that still has an outstanding balance
export function isOutstanding(status: InvoiceStatus): boolean {
  return ['PENDING', 'DUE_TODAY', 'OVERDUE', 'PARTIALLY_PAID'].includes(status);
}

// ── Payment progress colour ───────────────────────────────────────────────
// Returns a colour based on what percentage of the invoice has been paid.
export function getPaymentProgressColor(pct: number): string {
  if (pct >= 100) return '#10B981'; // fully paid — green
  if (pct >= 50)  return '#3B82F6'; // half paid — blue
  if (pct >= 25)  return '#F59E0B'; // quarter paid — amber
  return '#F43F5E';                  // barely started — red
}

// ── PDI helpers ───────────────────────────────────────────────────────────
export function getPdiColor(pdi: number): string {
  if (pdi >= 80) return '#10B981';
  if (pdi >= 60) return '#3B82F6';
  if (pdi >= 40) return '#F59E0B';
  if (pdi >= 20) return '#F97316';
  return '#F43F5E';
}

export function getPdiLabel(pdi: number): string {
  if (pdi >= 80) return 'Reliable';
  if (pdi >= 60) return 'Moderate';
  if (pdi >= 40) return 'High Risk';
  return 'Chronic';
}

export function getRiskBadgeClass(risk: string): string {
  switch (risk) {
    case 'RELIABLE':  return 'status-clear';
    case 'MODERATE':  return 'status-approaching';
    case 'HIGH_RISK': return 'status-due-today';
    case 'CHRONIC':   return 'status-overdue';
    default:          return 'status-clear';
  }
}

// ── Follow-up staleness colour ─────────────────────────────────────────────
export function getFollowUpColor(daysSince: number | null | undefined): string {
  if (daysSince == null)  return '#5A6E96';
  if (daysSince > 10)     return '#F43F5E';
  if (daysSince > 5)      return '#F59E0B';
  if (daysSince > 2)      return '#3B82F6';
  return '#10B981';
}

// ── Percentage helper ─────────────────────────────────────────────────────
export function calcPaymentPct(
  invoiceAmount: number | string,
  amountPaid:    number | string,
): number {
  const total = Number(invoiceAmount);
  const paid  = Number(amountPaid);
  if (!total || isNaN(total) || isNaN(paid)) return 0;
  return Math.min(100, Math.round((paid / total) * 100));
}

// ── Number formatting ─────────────────────────────────────────────────────
export function fmtNumber(n: number | string): string {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(v)) return '—';
  return new Intl.NumberFormat('en-NG').format(v);
}