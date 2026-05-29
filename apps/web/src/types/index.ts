// ── Enums ──────────────────────────────────────
export type UserRole = 'ADMIN' | 'CFO' | 'FINANCE' | 'SALES';
export type ClientRisk = 'RELIABLE' | 'MODERATE' | 'HIGH_RISK' | 'CHRONIC';
export type InvoiceStatus = 'PENDING' | 'DUE_TODAY' | 'OVERDUE' | 'PAID' | 'CANCELLED';
export type FollowUpType = 'EMAIL' | 'PHONE' | 'IN_PERSON' | 'LETTER' | 'WHATSAPP' | 'ESCALATION';
export type AlertType = 'DUE_7_DAYS' | 'DUE_3_DAYS' | 'DUE_1_DAY' | 'DUE_TODAY' | 'OVERDUE' | 'FOLLOW_UP_STALE' | 'PDI_THRESHOLD' | 'CREDIT_LIMIT_BREACH';
export type ColorCode = 'green' | 'blue' | 'amber' | 'red';

// ── User & Auth ────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organization: Organization;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  industry?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// ── Client ────────────────────────────────────
export interface Client {
  id: string;
  name: string;
  companyRegistration?: string;
  email?: string;
  phone?: string;
  sector?: string;
  creditLimit: number;
  slaDays: number;
  paymentDisciplineIndex: number;
  riskStatus: ClientRisk;
  isBlocked: boolean;
  blockedReason?: string;
  notes?: string;
  outstandingAmount?: number;
  utilizationPercent?: number;
  _count?: { invoices: number; slaViolations: number };
  createdAt: string;
}

// ── Invoice ────────────────────────────────────
export interface Invoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  invoiceAmount: number;
  invoiceDate: string;
  dueDate: string;
  status: InvoiceStatus;
  paidDate?: string;
  paidAmount?: number;
  currency: string;
  notes?: string;
  daysOverdue?: number;
  daysToDue?: number | null;
  daysSinceFollowUp?: number | null;
  colorCode?: ColorCode;
  followUpAlert?: boolean;
  client?: Pick<Client, 'id' | 'name' | 'paymentDisciplineIndex' | 'riskStatus'>;
  followUps?: FollowUp[];
  createdAt: string;
}

// ── Follow-up ──────────────────────────────────
export interface FollowUp {
  id: string;
  invoiceId: string;
  userId: string;
  followUpDate: string;
  followUpType: FollowUpType;
  notes?: string;
  responseReceived: boolean;
  nextFollowUpDate?: string;
  user?: Pick<User, 'id' | 'name' | 'role'>;
  invoice?: Pick<Invoice, 'invoiceNumber'> & { client?: Pick<Client, 'id' | 'name'> };
  createdAt: string;
}

// ── Alert ──────────────────────────────────────
export interface Alert {
  id: string;
  invoiceId: string;
  alertType: AlertType;
  channel: string;
  message: string;
  isRead: boolean;
  sentAt: string;
  readAt?: string;
  invoice?: Pick<Invoice, 'invoiceNumber'> & { client?: Pick<Client, 'name'> };
}

// ── SLA Violation ──────────────────────────────
export interface SlaViolation {
  id: string;
  clientId: string;
  invoiceId: string;
  violationDate: string;
  daysLate: number;
  resolved: boolean;
  resolvedAt?: string;
  client?: Pick<Client, 'id' | 'name' | 'sector' | 'paymentDisciplineIndex' | 'riskStatus'>;
  invoice?: Pick<Invoice, 'invoiceNumber' | 'invoiceAmount' | 'dueDate'>;
}

// ── Dashboard ──────────────────────────────────
export interface DashboardKPIs {
  totalOutstanding: number;
  overdueValue: number;
  overdueCount: number;
  dso: number;
  totalClients: number;
  blockedClients: number;
  chronicClients: number;
  dueTodayCount: number;
}

export interface AgingBuckets {
  current:  { value: number; count: number };
  '1_30':   { value: number; count: number };
  '31_60':  { value: number; count: number };
  '61_90':  { value: number; count: number };
  over_90:  { value: number; count: number };
}

export interface PdiDistribution {
  reliable: number;
  moderate: number;
  highRisk: number;
  chronic: number;
}

export interface PaymentTrendPoint {
  month: string;
  paidValue: number;
  overdueCount: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  agingBuckets: AgingBuckets;
  pdiDistribution: PdiDistribution;
  paymentTrend: PaymentTrendPoint[];
  topDefaulters: Client[];
  slaSummary: { totalViolations: number; unresolvedViolations: number; averageDaysLate: number };
  recentAlerts: Alert[];
  followUpCompliance: { overdueTotal: number; withRecentFollowUp: number; staleCount: number; complianceRate: number };
}

// ── Analytics ──────────────────────────────────
export interface AiInsight {
  type: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  title: string;
  body: string;
}

export interface PredictiveRisk {
  clientId: string;
  clientName: string;
  sector?: string;
  pdi: number;
  riskScore: number;
  latePaymentProbability: number;
  expectedDelayDays: number;
  riskStatus: ClientRisk;
  recommendation: string;
}

// ── Pagination ─────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ── API Response wrapper ───────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}
