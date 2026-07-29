/**
 * Generate a human-readable, reasonably-unique reference such as
 * `SR-202607-A1B2`. The `@unique` DB constraint remains the source of truth;
 * callers should retry on a P2002 collision (astronomically rare here).
 */
export function makeReference(prefix: string): string {
  const now  = new Date();
  const ym   = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ym}-${rand}`;
}
