import {
  Process, Processor, OnQueueFailed, OnQueueCompleted,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../config/prisma.service';
import { EmailService } from '../email/email.service';
import { EmailTemplateService } from '../email/email-template.service';
import { EmailJobName } from '../email/email.types';
import type {
  InvoiceCreatedPayload,
  PaymentReceiptPayload,
  PartialPaymentReceiptPayload,
  PreDueAlertPayload,
  OverdueAlertPayload,
  AccountBlockedPayload,
  AccountUnblockedPayload,
  PdiWarningPayload,
  PaymentConfirmationPayload,
  PaymentRevertedPayload,
  CreditLimitBreachedPayload,
  RiskStatusChangedPayload,
  ChronicClientPayload,
  NewSlaViolationPayload,
  ClientBlockedAuditPayload,
  StaleFollowUpPayload,
  WeeklyCfoReportPayload,
  NewClientOnboardedPayload,
  WelcomeUserPayload,
  RoleChangedPayload,
} from '../email/email.types';

@Processor('emails')
export class EmailsProcessor {
  private readonly logger = new Logger(EmailsProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly templates: EmailTemplateService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async financeRecipients(organizationId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId, isActive: true, role: { in: ['CFO', 'ADMIN', 'FINANCE'] } },
      select: { email: true },
    });
    return users.map(u => u.email).filter(Boolean);
  }

  private async cfoRecipients(organizationId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId, isActive: true, role: { in: ['CFO', 'ADMIN'] } },
      select: { email: true },
    });
    return users.map(u => u.email).filter(Boolean);
  }

  private async sendToMany(
    recipients: string[],
    subject: string,
    html: string,
    jobName: string,
    idempotencyBase?: string,
    metadata?: Record<string, unknown>,
  ) {
    if (!recipients.length) {
      this.logger.warn(`No recipients for job ${jobName} — skipping`);
      return;
    }
    await Promise.allSettled(
      recipients.map((to) =>
        this.emailService.send({
          to, subject, html, jobName,
          idempotencyKey: idempotencyBase ? `${idempotencyBase}:${to}` : undefined,
          metadata,
        }),
      ),
    );
  }

  // ── Client: Invoice Created ────────────────────────────────────────────────
  @Process(EmailJobName.INVOICE_CREATED)
  async handleInvoiceCreated(job: Job<InvoiceCreatedPayload>) {
    const p = job.data;
    if (!p.clientEmail) return;
    const { subject, html } = this.templates.invoiceCreated(p);
    await this.emailService.send({
      to: p.clientEmail, subject, html,
      jobName: EmailJobName.INVOICE_CREATED,
      idempotencyKey: `${EmailJobName.INVOICE_CREATED}:${p.invoiceId}`,
      metadata: { invoiceId: p.invoiceId, invoiceNumber: p.invoiceNumber },
    });
  }

  // ── Client: Full Payment Receipt ───────────────────────────────────────────
  @Process(EmailJobName.PAYMENT_RECEIPT)
  async handlePaymentReceipt(job: Job<PaymentReceiptPayload & { paymentRecordId: string }>) {
    const p = job.data;
    if (!p.clientEmail) return;
    const { subject, html } = this.templates.paymentReceipt(p);
    await this.emailService.send({
      to: p.clientEmail, subject, html,
      jobName: EmailJobName.PAYMENT_RECEIPT,
      idempotencyKey: `${EmailJobName.PAYMENT_RECEIPT}:${p.paymentRecordId}`,
      metadata: { invoiceId: p.invoiceId, invoiceNumber: p.invoiceNumber },
    });
  }

  // ── Client: Partial Payment Receipt ───────────────────────────────────────
  @Process(EmailJobName.PARTIAL_PAYMENT_RECEIPT)
  async handlePartialPaymentReceipt(job: Job<PartialPaymentReceiptPayload & { paymentRecordId: string }>) {
    const p = job.data;
    if (!p.clientEmail) return;
    const { subject, html } = this.templates.partialPaymentReceipt(p);
    await this.emailService.send({
      to: p.clientEmail, subject, html,
      jobName: EmailJobName.PARTIAL_PAYMENT_RECEIPT,
      idempotencyKey: `${EmailJobName.PARTIAL_PAYMENT_RECEIPT}:${p.paymentRecordId}`,
      metadata: { invoiceId: p.invoiceId },
    });
  }

  // ── Client: Pre-Due Alert ──────────────────────────────────────────────────
  @Process(EmailJobName.PRE_DUE_ALERT)
  async handlePreDueAlert(job: Job<PreDueAlertPayload>) {
    const p = job.data;
    if (!p.clientEmail) return;
    const { subject, html } = this.templates.preDueAlert(p);
    const alertType = p.daysUntilDue === 7 ? 'DUE_7_DAYS' : p.daysUntilDue === 3 ? 'DUE_3_DAYS' : 'DUE_1_DAY';
    await this.emailService.send({
      to: p.clientEmail, subject, html,
      jobName: EmailJobName.PRE_DUE_ALERT,
      idempotencyKey: `${EmailJobName.PRE_DUE_ALERT}:${p.invoiceId}:${alertType}`,
      metadata: { invoiceId: p.invoiceId, daysUntilDue: p.daysUntilDue },
    });
  }

  // ── Client: Overdue Alert ──────────────────────────────────────────────────
  @Process(EmailJobName.OVERDUE_ALERT)
  async handleOverdueAlert(job: Job<OverdueAlertPayload>) {
    const p = job.data;
    if (!p.clientEmail) return;
    const { subject, html } = this.templates.overdueAlert(p);
    // No idempotency key — daily resend is intentional; the cron guards via alertsSent JSON
    await this.emailService.send({
      to: p.clientEmail, subject, html,
      jobName: EmailJobName.OVERDUE_ALERT,
      metadata: { invoiceId: p.invoiceId, daysOverdue: p.daysOverdue },
    });
  }

  // ── Client: Account Blocked ────────────────────────────────────────────────
  @Process(EmailJobName.ACCOUNT_BLOCKED)
  async handleAccountBlocked(job: Job<AccountBlockedPayload>) {
    const p = job.data;
    if (!p.clientEmail) return;
    const { subject, html } = this.templates.accountBlocked(p);
    const date = new Date().toISOString().split('T')[0];
    await this.emailService.send({
      to: p.clientEmail, subject, html,
      jobName: EmailJobName.ACCOUNT_BLOCKED,
      idempotencyKey: `${EmailJobName.ACCOUNT_BLOCKED}:${p.clientId}:${date}`,
      metadata: { clientId: p.clientId, isAutoBlock: p.isAutoBlock },
    });
  }

  // ── Client: Account Unblocked ──────────────────────────────────────────────
  @Process(EmailJobName.ACCOUNT_UNBLOCKED)
  async handleAccountUnblocked(job: Job<AccountUnblockedPayload>) {
    const p = job.data;
    if (!p.clientEmail) return;
    const { subject, html } = this.templates.accountUnblocked(p);
    const date = new Date().toISOString().split('T')[0];
    await this.emailService.send({
      to: p.clientEmail, subject, html,
      jobName: EmailJobName.ACCOUNT_UNBLOCKED,
      idempotencyKey: `${EmailJobName.ACCOUNT_UNBLOCKED}:${p.clientId}:${date}`,
      metadata: { clientId: p.clientId },
    });
  }

  // ── Internal: PDI Warning ──────────────────────────────────────────────────
  @Process(EmailJobName.PDI_WARNING)
  async handlePdiWarning(job: Job<PdiWarningPayload & { organizationId: string }>) {
    const p = job.data;
    const { subject, html } = this.templates.pdiWarning(p);
    const date = new Date().toISOString().split('T')[0];
    const recipients = await this.cfoRecipients(p.organizationId);
    await this.sendToMany(
      recipients, subject, html,
      EmailJobName.PDI_WARNING,
      `${EmailJobName.PDI_WARNING}:${p.clientId}:${date}`,
      { clientId: p.clientId, pdiScore: p.pdiScore },
    );
  }

  // ── Finance: Payment Confirmation ──────────────────────────────────────────
  @Process(EmailJobName.PAYMENT_CONFIRMATION)
  async handlePaymentConfirmation(job: Job<PaymentConfirmationPayload & { paymentRecordId: string }>) {
    const p = job.data;
    const { subject, html } = this.templates.paymentConfirmation(p);
    const recipients = await this.financeRecipients(p.organizationId);
    await this.sendToMany(
      recipients, subject, html,
      EmailJobName.PAYMENT_CONFIRMATION,
      `${EmailJobName.PAYMENT_CONFIRMATION}:${p.paymentRecordId}`,
      { invoiceId: p.invoiceId, isFullyPaid: p.isFullyPaid },
    );
  }

  // ── Finance: Payment Reverted ──────────────────────────────────────────────
  @Process(EmailJobName.PAYMENT_REVERTED)
  async handlePaymentReverted(job: Job<PaymentRevertedPayload & { paymentRecordId: string }>) {
    const p = job.data;
    const { subject, html } = this.templates.paymentReverted(p);
    const recipients = await this.cfoRecipients(p.organizationId);
    await this.sendToMany(
      recipients, subject, html,
      EmailJobName.PAYMENT_REVERTED,
      `${EmailJobName.PAYMENT_REVERTED}:${p.paymentRecordId}`,
      { invoiceId: p.invoiceId },
    );
  }

  // ── Finance: Credit Limit Breached ────────────────────────────────────────
  @Process(EmailJobName.CREDIT_LIMIT_BREACHED)
  async handleCreditLimitBreached(job: Job<CreditLimitBreachedPayload>) {
    const p = job.data;
    const { subject, html } = this.templates.creditLimitBreached(p);
    const recipients = await this.cfoRecipients(p.organizationId);
    await this.sendToMany(
      recipients, subject, html,
      EmailJobName.CREDIT_LIMIT_BREACHED,
      `${EmailJobName.CREDIT_LIMIT_BREACHED}:${p.invoiceId}`,
      { clientId: p.clientId, utilizationPercent: p.utilizationPercent },
    );
  }

  // ── Finance: Risk Status Changed ───────────────────────────────────────────
  @Process(EmailJobName.RISK_STATUS_CHANGED)
  async handleRiskStatusChanged(job: Job<RiskStatusChangedPayload>) {
    const p = job.data;
    const { subject, html } = this.templates.riskStatusChanged(p);
    const date = new Date().toISOString().split('T')[0];
    const recipients = await this.cfoRecipients(p.organizationId);
    await this.sendToMany(
      recipients, subject, html,
      EmailJobName.RISK_STATUS_CHANGED,
      `${EmailJobName.RISK_STATUS_CHANGED}:${p.clientId}:${p.newRisk}:${date}`,
      { clientId: p.clientId, previousRisk: p.previousRisk, newRisk: p.newRisk },
    );
  }

  // ── Finance: Chronic Client Escalation ───────────────────────────────────
  @Process(EmailJobName.CHRONIC_CLIENT)
  async handleChronicClient(job: Job<ChronicClientPayload>) {
    const p = job.data;
    const { subject, html } = this.templates.chronicClient(p);
    const date = new Date().toISOString().split('T')[0];
    const recipients = await this.cfoRecipients(p.organizationId);
    await this.sendToMany(
      recipients, subject, html,
      EmailJobName.CHRONIC_CLIENT,
      `${EmailJobName.CHRONIC_CLIENT}:${p.clientId}:${date}`,
      { clientId: p.clientId, pdiScore: p.pdiScore },
    );
  }

  // ── Finance: New SLA Violation ────────────────────────────────────────────
  @Process(EmailJobName.NEW_SLA_VIOLATION)
  async handleNewSlaViolation(job: Job<NewSlaViolationPayload>) {
    const p = job.data;
    const { subject, html } = this.templates.newSlaViolation(p);
    const recipients = await this.financeRecipients(p.organizationId);
    await this.sendToMany(
      recipients, subject, html,
      EmailJobName.NEW_SLA_VIOLATION,
      `${EmailJobName.NEW_SLA_VIOLATION}:${p.invoiceId}`,
      { invoiceId: p.invoiceId, daysLate: p.daysLate },
    );
  }

  // ── Admin: Client Blocked Audit ───────────────────────────────────────────
  @Process(EmailJobName.CLIENT_BLOCKED_AUDIT)
  async handleClientBlockedAudit(job: Job<ClientBlockedAuditPayload>) {
    const p = job.data;
    const { subject, html } = this.templates.clientBlockedAudit(p);
    const date = new Date().toISOString().split('T')[0];
    const recipients = await this.cfoRecipients(p.organizationId);
    await this.sendToMany(
      recipients, subject, html,
      EmailJobName.CLIENT_BLOCKED_AUDIT,
      `${EmailJobName.CLIENT_BLOCKED_AUDIT}:${p.clientId}:${date}`,
      { clientId: p.clientId },
    );
  }

  // ── Internal: Stale Follow-up ─────────────────────────────────────────────
  @Process(EmailJobName.STALE_FOLLOWUP)
  async handleStaleFollowUp(job: Job<StaleFollowUpPayload>) {
    const p = job.data;
    if (!p.assigneeEmail) return;
    const { subject, html } = this.templates.staleFollowUp(p);
    await this.emailService.send({
      to: p.assigneeEmail, subject, html,
      jobName: EmailJobName.STALE_FOLLOWUP,
      metadata: { invoiceId: p.invoiceId, daysSinceFollowUp: p.daysSinceFollowUp },
    });
  }

  // ── CFO: Weekly Report ────────────────────────────────────────────────────
  @Process(EmailJobName.WEEKLY_CFO_REPORT)
  async handleWeeklyCfoReport(job: Job<WeeklyCfoReportPayload>) {
    const p = job.data;
    const { subject, html } = this.templates.weeklyCfoReport(p);
    const recipients = await this.cfoRecipients(p.organizationId);
    const week = this.isoWeek(new Date());
    await this.sendToMany(
      recipients, subject, html,
      EmailJobName.WEEKLY_CFO_REPORT,
      `${EmailJobName.WEEKLY_CFO_REPORT}:${p.organizationId}:${week}`,
      { organizationId: p.organizationId, week },
    );
  }

  // ── Operational: New Client Onboarded ────────────────────────────────────
  @Process(EmailJobName.NEW_CLIENT_ONBOARDED)
  async handleNewClientOnboarded(job: Job<NewClientOnboardedPayload>) {
    const p = job.data;
    const { subject, html } = this.templates.newClientOnboarded(p);
    const recipients = await this.financeRecipients(p.organizationId);
    await this.sendToMany(
      recipients, subject, html,
      EmailJobName.NEW_CLIENT_ONBOARDED,
      `${EmailJobName.NEW_CLIENT_ONBOARDED}:${p.clientId}`,
      { clientId: p.clientId },
    );
  }

  // ── Operational: Welcome User ─────────────────────────────────────────────
  @Process(EmailJobName.WELCOME_USER)
  async handleWelcomeUser(job: Job<WelcomeUserPayload>) {
    const p = job.data;
    if (!p.userEmail) return;
    const { subject, html } = this.templates.welcomeUser(p);
    await this.emailService.send({
      to: p.userEmail, subject, html,
      jobName: EmailJobName.WELCOME_USER,
      idempotencyKey: `${EmailJobName.WELCOME_USER}:${p.userId}`,
      metadata: { userId: p.userId, role: p.role },
    });
  }

  // ── Operational: Role Changed ─────────────────────────────────────────────
  @Process(EmailJobName.ROLE_CHANGED)
  async handleRoleChanged(job: Job<RoleChangedPayload>) {
    const p = job.data;
    if (!p.userEmail) return;
    const { subject, html } = this.templates.roleChanged(p);
    await this.emailService.send({
      to: p.userEmail, subject, html,
      jobName: EmailJobName.ROLE_CHANGED,
      idempotencyKey: `${EmailJobName.ROLE_CHANGED}:${p.userId}:${p.newRole}`,
      metadata: { userId: p.userId, newRole: p.newRole },
    });
  }

  // ── Queue lifecycle hooks ──────────────────────────────────────────────────
  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Email job "${job.name}" #${job.id} failed (attempt ${job.attemptsMade}): ${error.message}`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.debug(`Email job "${job.name}" #${job.id} completed`);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  private isoWeek(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }
}
