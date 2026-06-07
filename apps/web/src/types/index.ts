// ─────────────────────────────────────────────────────────────────────────────
// apps/web/src/types/index.ts
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'CFO' | 'FINANCE' | 'SALES';

export type ClientRisk = 'RELIABLE' | 'MODERATE' | 'HIGH_RISK' | 'CHRONIC';

// ── Invoice status ─────────────────────────────────────────────────────────
// PARTIALLY_PAID is new — at least one payment has been made but the
// remaining balance is still > 0.
export type InvoiceStatus =
  | 'PENDING'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'CANCELLED';

export type FollowUpType =
  | 'EMAIL'
  | 'PHONE'
  | 'IN_PERSON'
  | 'LETTER'
  | 'WHATSAPP'
  | 'ESCALATION';

export type AlertType =
  | 'DUE_7_DAYS'
  | 'DUE_3_DAYS'
  | 'DUE_1_DAY'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'FOLLOW_UP_STALE'
  | 'PDI_THRESHOLD'
  | 'CREDIT_LIMIT_BREACH';

// ── PaymentRecord ──────────────────────────────────────────────────────────
// Immutable ledger entry for each payment event against an invoice.
// Reverted records are kept with isReverted = true; they are never deleted.
export interface PaymentRecord {
  id:          string;
  invoiceId:   string;
  amount:      number | string;
  paymentDate: string;
  paidBy?:     string | null;
  user?:       { id: string; name: string } | null;
  notes?:      string | null;
  isReverted:  boolean;
  revertedAt?: string | null;
  revertedBy?: string | null;
  createdAt:   string;
  updatedAt:   string;
}

// ── MarkPaidResult ─────────────────────────────────────────────────────────
// Shape returned from PATCH /invoices/:id/mark-paid
export interface MarkPaidResult {
  invoice:          Invoice;
  payment:          PaymentRecord;
  isFullyPaid:      boolean;
  amountPaid:       number;
  remainingBalance: number;
}

// ── RevertPaymentResult ────────────────────────────────────────────────────
// Shape returned from PATCH /invoices/:id/revert-payment
export interface RevertPaymentResult {
  invoice:             Invoice;
  revertedAmount:      number;
  restoredStatus:      InvoiceStatus;
  newAmountPaid:       number;
  newRemainingBalance: number;
}

// ── Invoice ────────────────────────────────────────────────────────────────
export interface Invoice {
  id:            string;
  clientId:      string;
  invoiceNumber: string;
  invoiceAmount: number | string;
  invoiceDate:   string;
  dueDate:       string;
  status:        InvoiceStatus;
  currency:      string;
  notes?:        string | null;

  // Payment tracking fields
  amountPaid:       number | string;
  remainingBalance: number | string;
  paidAmount?:      number | string | null; // backward-compat alias
  paidDate?:        string | null;

  // Computed by backend enrichInvoice()
  daysOverdue?:          number | null;
  daysToDue?:            number | null;
  daysSinceFollowUp?:    number | null;
  followUpAlert?:        boolean;
  paymentProgressPct?:   number; // 0–100
  colorCode?:            'green' | 'blue' | 'amber' | 'red';

  // Relations
  client?:        Client | null;
  followUps?:     FollowUp[];
  payments?:      PaymentRecord[];
  slaViolations?: SlaViolation[];

  createdAt: string;
  updatedAt: string;
}

// ── Client ─────────────────────────────────────────────────────────────────
export interface Client {
  id:                     string;
  organizationId:         string;
  name:                   string;
  email?:                 string | null;
  phone?:                 string | null;
  sector?:                string | null;
  companyRegistration?:   string | null;
  creditLimit:            number | string;
  slaDays:                number;
  paymentDisciplineIndex: number | string;
  riskStatus:             ClientRisk;
  isBlocked:              boolean;
  blockedReason?:         string | null;
  notes?:                 string | null;
  outstandingAmount?:     number | null;
  utilizationPercent?:    number | null;
  createdAt:              string;
  updatedAt:              string;
}

// ── FollowUp ───────────────────────────────────────────────────────────────
export interface FollowUp {
  id:               string;
  invoiceId:        string;
  userId:           string;
  followUpDate:     string;
  followUpType:     FollowUpType;
  notes?:           string | null;
  responseReceived: boolean;
  nextFollowUpDate?: string | null;
  createdAt:        string;
  user?:            { id: string; name: string; role: UserRole } | null;
}

// ── SlaViolation ───────────────────────────────────────────────────────────
export interface SlaViolation {
  id:            string;
  clientId:      string;
  invoiceId:     string;
  violationDate: string;
  daysLate:      number;
  resolved:      boolean;
  resolvedAt?:   string | null;
  createdAt:     string;
  client?:       Pick<Client, 'id' | 'name' | 'sector' | 'paymentDisciplineIndex'> | null;
  invoice?:      Pick<Invoice, 'id' | 'invoiceNumber' | 'invoiceAmount' | 'dueDate'> | null;
}

// ── Alert ──────────────────────────────────────────────────────────────────
export interface Alert {
  id:        string;
  invoiceId: string;
  alertType: AlertType;
  channel:   string;
  message:   string;
  isRead:    boolean;
  sentAt:    string;
  readAt?:   string | null;
  invoice?:  Pick<Invoice, 'id' | 'invoiceNumber' | 'client'> | null;
}

// ── User ───────────────────────────────────────────────────────────────────
export interface User {
  id:             string;
  name:           string;
  email:          string;
  role:           UserRole;
  isActive:       boolean;
  lastLoginAt?:   string | null;
  createdAt:      string;
  organization?:  { id: string; name: string };
}

// ── Pagination meta ────────────────────────────────────────────────────────
export interface PaginationMeta {
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ── API wrapper ────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data:    T;
  message?: string;
}