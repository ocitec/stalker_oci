export type ActionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ActionRecommendation {
  action: string;
  severity: ActionSeverity;
  reasons: string[];
}

// Exposure tiers (NGN)
const LARGE_EXPOSURE  = 50_000_000;  // ₦50M+  → +30 effective days
const MEDIUM_EXPOSURE = 10_000_000;  // ₦10M+  → +15 effective days

export function computeRecommendedAction(params: {
  maxDaysOverdue:    number;
  pdi:               number;
  riskStatus:        string;
  outstandingAmount: number;
  utilizationPercent?: number;
  slaBreachCount?:     number;
}): ActionRecommendation {
  const {
    maxDaysOverdue, pdi, riskStatus, outstandingAmount,
    utilizationPercent = 0, slaBreachCount = 0,
  } = params;

  // Build reason phrases up-front so every path gets the same detail
  const reasons: string[] = [];
  if (maxDaysOverdue > 0)       reasons.push(`${maxDaysOverdue} days overdue`);
  if (slaBreachCount > 0)       reasons.push(`${slaBreachCount} unresolved SLA breach${slaBreachCount !== 1 ? 'es' : ''}`);
  if (pdi < 40)                 reasons.push(`PDI ${pdi} — Chronic delayer`);
  else if (pdi < 60)            reasons.push(`PDI ${pdi} — High risk`);
  if (utilizationPercent > 100) reasons.push(`Credit limit exceeded at ${utilizationPercent}%`);
  if (outstandingAmount > 0)    reasons.push(`₦${Math.round(outstandingAmount).toLocaleString('en-NG')} outstanding`);
  if (outstandingAmount >= LARGE_EXPOSURE)
                                reasons.push('Large-exposure account — accelerated escalation');
  else if (outstandingAmount >= MEDIUM_EXPOSURE)
                                reasons.push('Medium-exposure account — elevated priority');

  // Effective days = actual days overdue + bonuses for exposure size + credit utilization
  const exposureBonus     = outstandingAmount >= LARGE_EXPOSURE  ? 30
                          : outstandingAmount >= MEDIUM_EXPOSURE ? 15
                          : 0;
  const utilizationBonus  = utilizationPercent > 150 ? 20
                          : utilizationPercent > 100 ? 10
                          : 0;
  const effectiveDays     = maxDaysOverdue + exposureBonus + utilizationBonus;

  const isHighRisk        = riskStatus === 'CHRONIC' || riskStatus === 'HIGH_RISK';
  const isChronic         = riskStatus === 'CHRONIC';

  // Decision tree — most severe match wins
  if (effectiveDays > 90 && isChronic) {
    return { action: 'Legal Review Recommended',   severity: 'CRITICAL', reasons };
  }
  if (effectiveDays > 75 && isHighRisk) {
    return { action: 'Final Demand Required',       severity: 'CRITICAL', reasons };
  }
  if (effectiveDays > 60 && isHighRisk) {
    return { action: 'Escalate to CFO/GMD',         severity: 'HIGH',     reasons };
  }
  if (effectiveDays > 45 && isHighRisk) {
    return { action: 'Escalate to Finance Manager', severity: 'HIGH',     reasons };
  }
  if (utilizationPercent > 100 || (isChronic && outstandingAmount > 0)) {
    return { action: 'Recommend Credit Hold',       severity: 'HIGH',     reasons };
  }
  if (effectiveDays > 30 && isHighRisk) {
    return { action: 'Payment Plan Negotiation',    severity: 'MEDIUM',   reasons };
  }
  if (effectiveDays > 14) {
    return { action: 'Schedule Follow-Up Call',     severity: 'MEDIUM',   reasons };
  }
  if (effectiveDays > 0) {
    return { action: 'Send Reminder',               severity: 'LOW',      reasons };
  }
  return { action: 'Monitor Account',               severity: 'LOW',      reasons: ['Account within normal parameters'] };
}
