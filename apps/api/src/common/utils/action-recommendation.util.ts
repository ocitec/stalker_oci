export type ActionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ActionRecommendation {
  action: string;
  severity: ActionSeverity;
  reasons: string[];
}

export function computeRecommendedAction(params: {
  maxDaysOverdue: number;
  pdi: number;
  riskStatus: string;
  outstandingAmount: number;
  utilizationPercent?: number;
  slaBreachCount?: number;
}): ActionRecommendation {
  const {
    maxDaysOverdue, pdi, riskStatus, outstandingAmount,
    utilizationPercent = 0, slaBreachCount = 0,
  } = params;

  const reasons: string[] = [];
  if (maxDaysOverdue > 0) reasons.push(`${maxDaysOverdue} days overdue`);
  if (slaBreachCount > 0) reasons.push(`${slaBreachCount} unresolved SLA breach${slaBreachCount !== 1 ? 'es' : ''}`);
  if (pdi < 40) reasons.push(`PDI ${pdi} — Chronic delayer`);
  else if (pdi < 60) reasons.push(`PDI ${pdi} — High risk`);
  if (utilizationPercent > 100) reasons.push(`Credit limit exceeded at ${utilizationPercent}%`);
  if (outstandingAmount > 0) {
    reasons.push(`₦${Math.round(outstandingAmount).toLocaleString('en-NG')} outstanding`);
  }

  if (maxDaysOverdue > 90 && riskStatus === 'CHRONIC') {
    return { action: 'Legal Review Recommended', severity: 'CRITICAL', reasons };
  }
  if (maxDaysOverdue > 60 && (riskStatus === 'CHRONIC' || riskStatus === 'HIGH_RISK')) {
    return { action: 'Final Demand Required', severity: 'CRITICAL', reasons };
  }
  if (maxDaysOverdue > 45 && (riskStatus === 'CHRONIC' || riskStatus === 'HIGH_RISK')) {
    return { action: 'Escalate to CFO/GMD', severity: 'HIGH', reasons };
  }
  if (maxDaysOverdue > 30 && (riskStatus === 'CHRONIC' || riskStatus === 'HIGH_RISK')) {
    return { action: 'Escalate to Finance Manager', severity: 'HIGH', reasons };
  }
  if (utilizationPercent > 100 || (riskStatus === 'CHRONIC' && outstandingAmount > 0)) {
    return { action: 'Recommend Credit Hold', severity: 'HIGH', reasons };
  }
  if (maxDaysOverdue > 14) {
    return { action: 'Schedule Follow-Up Call', severity: 'MEDIUM', reasons };
  }
  if (maxDaysOverdue > 0) {
    return { action: 'Send Reminder', severity: 'LOW', reasons };
  }
  return { action: 'Monitor Account', severity: 'LOW', reasons: ['Account within normal parameters'] };
}
