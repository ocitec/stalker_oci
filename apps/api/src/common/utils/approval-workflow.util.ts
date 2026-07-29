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

export const APPROVAL_LADDER: ApprovalLevelRule[] = [
  { level: 1, role: UserRole.FINANCE, minValue: 0 },
  { level: 2, role: UserRole.CFO,     minValue: 1_000_000 },
];

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
