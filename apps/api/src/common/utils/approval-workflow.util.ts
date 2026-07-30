import { UserRole } from '@prisma/client';

/**
 * Configurable multi-level approval ladder for Transaction Control.
 *
 * Each rule declares the role that signs off at a given level and the transaction
 * value at or above which that level becomes *required*. Level 1 (minValue 0) is
 * always required; higher levels switch on as the value crosses each threshold.
 * Replace/extend this array to change org approval policy — the workflow engine
 * derives everything (required levels, expected approver, authorisation) from it.
 */
export interface ApprovalLevelRule {
  level:    number;
  role:     UserRole;
  minValue: number;
}

/**
 * Build the ladder from environment configuration so thresholds/roles are never
 * hard-coded business rules. Two override mechanisms (both optional):
 *
 *   APPROVAL_LADDER_JSON — full ladder, e.g.
 *     [{"level":1,"role":"FINANCE","minValue":0},{"level":2,"role":"CFO","minValue":1000000}]
 *   APPROVAL_L2_THRESHOLD — just the value at which a second (CFO) approval kicks in.
 *
 * Falls back to a sensible default (FINANCE always; +CFO at/above ₦1,000,000).
 */
function buildLadder(): ApprovalLevelRule[] {
  const raw = process.env.APPROVAL_LADDER_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ApprovalLevelRule[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map(r => ({ level: Number(r.level), role: r.role as UserRole, minValue: Number(r.minValue) }))
          .sort((a, b) => a.level - b.level);
      }
    } catch {
      // Malformed JSON → fall through to threshold/default.
    }
  }
  const l2Threshold = Number(process.env.APPROVAL_L2_THRESHOLD ?? 1_000_000);
  return [
    { level: 1, role: UserRole.FINANCE, minValue: 0 },
    { level: 2, role: UserRole.CFO,     minValue: l2Threshold },
  ];
}

export const APPROVAL_LADDER: ApprovalLevelRule[] = buildLadder();

/** Role seniority — a more senior role may act on any junior level. */
const ROLE_SENIORITY: Record<UserRole, number> = {
  SALES:   1,
  FINANCE: 2,
  CFO:     3,
  ADMIN:   4,
};

/** How many approval levels a transaction of the given value must clear. */
export function requiredApprovalLevels(value: number): number {
  const levels = APPROVAL_LADDER.filter(r => value >= r.minValue).length;
  return Math.max(1, levels);
}

/** The role expected to approve at a specific level (null if the level is undefined). */
export function roleForLevel(level: number): UserRole | null {
  return APPROVAL_LADDER.find(r => r.level === level)?.role ?? null;
}

/**
 * The approver role expected next, given how many levels are already cleared.
 * Returns null when no further approval is required.
 */
export function nextApproverRole(clearedLevels: number, value: number): UserRole | null {
  if (clearedLevels >= requiredApprovalLevels(value)) return null;
  return roleForLevel(clearedLevels + 1);
}

/** Whether a user's role is senior enough to approve the given level. */
export function canApproveLevel(userRole: UserRole, level: number): boolean {
  const rule = APPROVAL_LADDER.find(r => r.level === level);
  if (!rule) return false;
  return ROLE_SENIORITY[userRole] >= ROLE_SENIORITY[rule.role];
}
