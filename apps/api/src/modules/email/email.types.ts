// ── Job name registry ──────────────────────────────────────────────────────────
export const EmailJobName = {
  // Client-facing
  INVOICE_CREATED:          'send-invoice-created',
  PAYMENT_RECEIPT:          'send-payment-receipt',
  PARTIAL_PAYMENT_RECEIPT:  'send-partial-payment-receipt',
  PRE_DUE_ALERT:            'send-pre-due-alert',
  OVERDUE_ALERT:            'send-overdue-alert',
  ACCOUNT_BLOCKED:          'send-account-blocked',
  ACCOUNT_UNBLOCKED:        'send-account-unblocked',
  PDI_WARNING:              'send-pdi-warning',

  // Finance / internal
  PAYMENT_CONFIRMATION:     'send-payment-confirmation',
  PAYMENT_REVERTED:         'send-payment-reverted',
  CREDIT_LIMIT_BREACHED:    'send-credit-limit-breached',
  RISK_STATUS_CHANGED:      'send-risk-status-changed',
  CHRONIC_CLIENT:           'send-chronic-client',
  NEW_SLA_VIOLATION:        'send-new-sla-violation',
  CLIENT_BLOCKED_AUDIT:     'send-client-blocked-audit',
  STALE_FOLLOWUP:           'send-stale-followup',

  // Reports
  WEEKLY_CFO_REPORT:        'send-weekly-cfo-report',

  // Operational
  NEW_CLIENT_ONBOARDED:     'send-new-client-onboarded',
  WELCOME_USER:             'send-welcome-user',
  ROLE_CHANGED:             'send-role-changed',
} as const;

export type EmailJobNameValue = (typeof EmailJobName)[keyof typeof EmailJobName];

// ── Payload interfaces ─────────────────────────────────────────────────────────

export interface InvoiceCreatedPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number | string;
  invoiceDate: string | Date;
  dueDate: string | Date;
  currency: string;
  notes?: string;
}

export interface PaymentReceiptPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  totalAmount: number | string;
  amountPaid: number | string;
  paymentDate: string | Date;
  paidBy?: string;
  notes?: string;
}

export interface PartialPaymentReceiptPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  totalAmount: number | string;
  amountPaid: number | string;
  remainingBalance: number | string;
  paymentDate: string | Date;
}

export interface PreDueAlertPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number | string;
  dueDate: string | Date;
  daysUntilDue: number;
}

export interface OverdueAlertPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number | string;
  dueDate: string | Date;
  daysOverdue: number;
}

export interface AccountBlockedPayload {
  clientId: string;
  clientName: string;
  clientEmail: string;
  blockedReason: string;
  isAutoBlock: boolean;
  pdiScore?: number;
}

export interface AccountUnblockedPayload {
  clientId: string;
  clientName: string;
  clientEmail: string;
}

export interface PdiWarningPayload {
  clientId: string;
  clientName: string;
  clientEmail: string;
  pdiScore: number;
  isBlocked: boolean;
}

export interface PaymentConfirmationPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  amountPaid: number | string;
  remainingBalance: number | string;
  isFullyPaid: boolean;
  paymentDate: string | Date;
  recordedBy?: string;
  organizationId: string;
}

export interface PaymentRevertedPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  revertedAmount: number | string;
  restoredStatus: string;
  revertedBy?: string;
  organizationId: string;
}

export interface CreditLimitBreachedPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  creditLimit: number | string;
  currentOutstanding: number | string;
  utilizationPercent: number;
  organizationId: string;
}

export interface RiskStatusChangedPayload {
  clientId: string;
  clientName: string;
  previousRisk: string;
  newRisk: string;
  pdiScore: number;
  organizationId: string;
}

export interface ChronicClientPayload {
  clientId: string;
  clientName: string;
  pdiScore: number;
  totalViolations: number;
  organizationId: string;
}

export interface NewSlaViolationPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  amount: number | string;
  dueDate: string | Date;
  daysLate: number;
  organizationId: string;
}

export interface ClientBlockedAuditPayload {
  clientId: string;
  clientName: string;
  blockedReason: string;
  blockedBy?: string;
  organizationId: string;
}

export interface StaleFollowUpPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  assigneeEmail: string;
  daysSinceFollowUp: number;
  amount: number | string;
}

export interface WeeklyCfoReportPayload {
  organizationId: string;
  organizationName: string;
  period: { from: string | Date; to: string | Date };
  kpis: {
    collectedThisWeek: number;
    newOverdueInvoices: number;
    followUpsLogged: number;
    totalOutstanding: number;
    currentDso: number;
  };
  newSlaViolations: number;
  chronicClients: Array<{ name: string; pdi: number }>;
  riskChanges: Array<{ name: string; from: string; to: string }>;
  topOverdueClients: Array<{ name: string; amount: number }>;
}

export interface NewClientOnboardedPayload {
  clientId: string;
  clientName: string;
  sector?: string;
  creditLimit: number | string;
  slaDays: number;
  organizationId: string;
  organizationName: string;
}

export interface WelcomeUserPayload {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  organizationName: string;
}

export interface RoleChangedPayload {
  userId: string;
  userName: string;
  userEmail: string;
  previousRole: string;
  newRole: string;
  organizationName: string;
}

// ── EmailService contract ──────────────────────────────────────────────────────

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  jobName: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailSendResult {
  provider: 'POSTMARK' | 'RESEND';
  messageId: string | null;
  usedFallback: boolean;
  skipped: boolean;
}
