// Status → badge styling for the financial control chain
// (Sales / Credit / Transaction / Fulfilment / Payment verification).

type Tone = 'green' | 'red' | 'amber' | 'blue' | 'indigo' | 'muted';

const TONE: Record<Tone, { bg: string; color: string }> = {
  green:  { bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
  red:    { bg: 'rgba(244,63,94,0.12)',  color: '#F43F5E' },
  amber:  { bg: 'rgba(245,158,11,0.14)', color: '#F59E0B' },
  blue:   { bg: 'rgba(59,130,246,0.14)', color: '#3B82F6' },
  indigo: { bg: 'rgba(99,102,241,0.14)', color: '#8B8DF8' },
  muted:  { bg: 'rgba(90,110,150,0.14)', color: '#8CA0C6' },
};

const STATUS_TONE: Record<string, Tone> = {
  // workflow statuses
  DRAFT: 'muted', SUBMITTED: 'blue', PENDING: 'amber', PENDING_REVIEW: 'amber',
  APPROVED: 'green', REJECTED: 'red', DECLINED: 'red', CANCELLED: 'muted',
  ON_HOLD: 'amber', CONVERTED: 'indigo', EXPIRED: 'muted',
  // payment verification
  VERIFIED: 'green', FAILED: 'red', PARTIALLY_PAID: 'blue',
  // fulfilment
  PROCESSING: 'blue', FULFILLED: 'green', PARTIALLY_FULFILLED: 'amber',
};

export function prettyStatus(s?: string | null): string {
  if (!s) return '—';
  return s.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

/** Returns { bg, color, label } for a status pill. */
export function chainBadge(status?: string | null) {
  const tone = (status && STATUS_TONE[status]) || 'muted';
  return { ...TONE[tone], label: prettyStatus(status) };
}
