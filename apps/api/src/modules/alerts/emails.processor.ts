import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';

// ── Job payload shapes ──────────────────────────────────────────────────────
interface PreDueAlertPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number | string;
  dueDate: string | Date;
  daysUntilDue: number;
}

interface OverdueAlertPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number | string;
  dueDate: string | Date;
  daysOverdue: number;
}

interface PdiWarningPayload {
  clientId: string;
  clientName: string;
  clientEmail: string;
  pdiScore: number;
  isBlocked: boolean;
}

interface StaleFollowUpPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  assigneeEmail: string;
  daysSinceFollowUp: number;
  amount: number | string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtCurrency(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);
}

function fmtDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
}

function urgencyColor(days: number): string {
  if (days <= 1) return '#F43F5E';
  if (days <= 3) return '#F59E0B';
  return '#3B82F6';
}

// ── HTML Email Templates ─────────────────────────────────────────────────────
function baseTemplate(content: string, previewText: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>STALKER — Cash Control</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#0C0F1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <!-- Preview text -->
  <div style="display:none;max-height:0;overflow:hidden;color:#0C0F1A;">${previewText}</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0F1A;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Logo / Brand header -->
        <tr>
          <td style="padding:0 0 24px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-family:'SF Mono',monospace;font-size:18px;font-weight:700;color:#F59E0B;letter-spacing:0.08em;">
                    STALKER
                  </span>
                  <span style="font-size:12px;color:#5A6E96;margin-left:8px;">Cash Control System</span>
                </td>
                <td align="right">
                  <span style="font-size:10px;color:#5A6E96;font-family:'SF Mono',monospace;">
                    ${new Date().toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card body -->
        <tr>
          <td style="background:#131929;border:1px solid #2A3A5C;border-radius:12px;padding:32px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 0 0 0;text-align:center;">
            <p style="margin:0;font-size:10px;color:#5A6E96;line-height:1.6;">
              This is an automated notification from STALKER Cash Control.<br />
              Do not reply to this email. To manage your notifications, log in to the dashboard.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function preDueTemplate(p: PreDueAlertPayload): string {
  const color = urgencyColor(p.daysUntilDue);
  const urgencyLabel = p.daysUntilDue === 1 ? 'Due Tomorrow' : `Due in ${p.daysUntilDue} Days`;

  const content = `
    <!-- Alert badge -->
    <div style="display:inline-block;background:${color}22;border:1px solid ${color}55;border-radius:6px;padding:4px 10px;margin-bottom:20px;">
      <span style="font-size:11px;font-weight:700;color:${color};letter-spacing:0.06em;">⏰ ${urgencyLabel.toUpperCase()}</span>
    </div>

    <!-- Headline -->
    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#E8EDF8;line-height:1.3;">
      Invoice Due Soon
    </h1>
    <p style="margin:0 0 28px 0;font-size:14px;color:#8B9DC3;line-height:1.6;">
      A payment is approaching its due date. Ensure collection action is underway.
    </p>

    <!-- Invoice detail block -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A2236;border:1px solid #2A3A5C;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${detailRow('Client', `<strong style="color:#E8EDF8;">${p.clientName}</strong>`)}
          ${detailRow('Invoice', `<code style="font-family:'SF Mono',monospace;color:#F59E0B;">${p.invoiceNumber}</code>`)}
          ${detailRow('Amount', `<strong style="font-family:'SF Mono',monospace;font-size:16px;color:#E8EDF8;">${fmtCurrency(p.amount)}</strong>`)}
          ${detailRow('Due Date', `<strong style="color:${color};">${fmtDate(p.dueDate)}</strong>`)}
          ${detailRow('Days Remaining', `<strong style="font-family:'SF Mono',monospace;font-size:18px;color:${color};">${p.daysUntilDue}d</strong>`)}
        </table>
      </td></tr>
    </table>

    <!-- Urgency bar -->
    <div style="background:#1F2B42;border-radius:4px;height:6px;margin-bottom:28px;overflow:hidden;">
      <div style="background:${color};height:100%;width:${Math.max(10, 100 - (p.daysUntilDue / 7) * 100)}%;border-radius:4px;"></div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/invoices"
         style="display:inline-block;background:#F59E0B;color:#000;font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
        View Invoice in Dashboard →
      </a>
    </div>
  `;

  return baseTemplate(content, `${urgencyLabel}: ${p.invoiceNumber} — ${fmtCurrency(p.amount)} from ${p.clientName}`);
}

function overdueTemplate(p: OverdueAlertPayload): string {
  const content = `
    <div style="display:inline-block;background:#F43F5E22;border:1px solid #F43F5E55;border-radius:6px;padding:4px 10px;margin-bottom:20px;">
      <span style="font-size:11px;font-weight:700;color:#F43F5E;letter-spacing:0.06em;">🚨 OVERDUE — ${p.daysOverdue} DAYS PAST DUE</span>
    </div>

    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#E8EDF8;">Invoice Overdue</h1>
    <p style="margin:0 0 28px 0;font-size:14px;color:#8B9DC3;line-height:1.6;">
      This invoice has not been paid and is now ${p.daysOverdue} day(s) past its due date. Immediate follow-up required.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A2236;border:1px solid #F43F5E33;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${detailRow('Client', `<strong style="color:#E8EDF8;">${p.clientName}</strong>`)}
          ${detailRow('Invoice', `<code style="font-family:'SF Mono',monospace;color:#F59E0B;">${p.invoiceNumber}</code>`)}
          ${detailRow('Amount Outstanding', `<strong style="font-family:'SF Mono',monospace;font-size:16px;color:#F43F5E;">${fmtCurrency(p.amount)}</strong>`)}
          ${detailRow('Original Due Date', `<span style="color:#8B9DC3;">${fmtDate(p.dueDate)}</span>`)}
          ${detailRow('Days Overdue', `<strong style="font-family:'SF Mono',monospace;font-size:18px;color:#F43F5E;">${p.daysOverdue}d</strong>`)}
        </table>
      </td></tr>
    </table>

    <div style="background:#F43F5E15;border:1px solid #F43F5E33;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
      <p style="margin:0;font-size:12px;color:#F43F5E;line-height:1.6;">
        ⚠️ This client's Payment Discipline Index (PDI) may be downgraded if payment is not received. Clients with PDI below 30 are automatically blocked from new credit.
      </p>
    </div>

    <div style="text-align:center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/followups"
         style="display:inline-block;background:#F43F5E;color:#fff;font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">
        Log Follow-up Now →
      </a>
    </div>
  `;

  return baseTemplate(content, `OVERDUE: ${p.invoiceNumber} — ${fmtCurrency(p.amount)} is ${p.daysOverdue}d past due`);
}

function pdiWarningTemplate(p: PdiWarningPayload): string {
  const statusColor = p.isBlocked ? '#F43F5E' : '#F59E0B';
  const statusLabel = p.isBlocked ? 'AUTOMATICALLY BLOCKED' : 'PDI THRESHOLD WARNING';

  const content = `
    <div style="display:inline-block;background:${statusColor}22;border:1px solid ${statusColor}55;border-radius:6px;padding:4px 10px;margin-bottom:20px;">
      <span style="font-size:11px;font-weight:700;color:${statusColor};letter-spacing:0.06em;">🛡 ${statusLabel}</span>
    </div>

    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#E8EDF8;">PDI Alert: ${p.clientName}</h1>
    <p style="margin:0 0 28px 0;font-size:14px;color:#8B9DC3;line-height:1.6;">
      ${p.isBlocked
        ? `${p.clientName}'s Payment Discipline Index has dropped below 30. They have been automatically blocked from receiving new credit.`
        : `${p.clientName}'s Payment Discipline Index has fallen to a concerning level and requires CFO review.`
      }
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A2236;border:1px solid ${statusColor}33;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${detailRow('Client', `<strong style="color:#E8EDF8;">${p.clientName}</strong>`)}
          ${detailRow('Current PDI', `<strong style="font-family:'SF Mono',monospace;font-size:20px;color:${statusColor};">${p.pdiScore}</strong>`)}
          ${detailRow('Auto-Block Threshold', `<span style="font-family:'SF Mono',monospace;color:#8B9DC3;">30</span>`)}
          ${detailRow('Status', `<strong style="color:${statusColor};">${p.isBlocked ? 'BLOCKED' : 'AT RISK'}</strong>`)}
        </table>
      </td></tr>
    </table>

    <div style="text-align:center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/clients"
         style="display:inline-block;background:${statusColor};color:${p.isBlocked ? '#fff' : '#000'};font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">
        Review Client →
      </a>
    </div>
  `;

  return baseTemplate(content, `PDI Alert: ${p.clientName} — Score ${p.pdiScore}${p.isBlocked ? ' (Blocked)' : ''}`);
}

function staleFollowUpTemplate(p: StaleFollowUpPayload): string {
  const content = `
    <div style="display:inline-block;background:#F59E0B22;border:1px solid #F59E0B55;border-radius:6px;padding:4px 10px;margin-bottom:20px;">
      <span style="font-size:11px;font-weight:700;color:#F59E0B;letter-spacing:0.06em;">⏱ FOLLOW-UP OVERDUE — ${p.daysSinceFollowUp} DAYS</span>
    </div>

    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#E8EDF8;">Stale Follow-up Alert</h1>
    <p style="margin:0 0 28px 0;font-size:14px;color:#8B9DC3;line-height:1.6;">
      An overdue invoice has not had any follow-up contact in ${p.daysSinceFollowUp} days. Contact the client immediately to maintain collection momentum.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A2236;border:1px solid #F59E0B33;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${detailRow('Client', `<strong style="color:#E8EDF8;">${p.clientName}</strong>`)}
          ${detailRow('Invoice', `<code style="font-family:'SF Mono',monospace;color:#F59E0B;">${p.invoiceNumber}</code>`)}
          ${detailRow('Amount', `<strong style="font-family:'SF Mono',monospace;color:#E8EDF8;">${fmtCurrency(p.amount)}</strong>`)}
          ${detailRow('Days Since Contact', `<strong style="font-family:'SF Mono',monospace;font-size:18px;color:#F59E0B;">${p.daysSinceFollowUp}d</strong>`)}
        </table>
      </td></tr>
    </table>

    <div style="text-align:center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/followups"
         style="display:inline-block;background:#F59E0B;color:#000;font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">
        Log Follow-up →
      </a>
    </div>
  `;

  return baseTemplate(content, `Stale Follow-up: ${p.invoiceNumber} — No contact in ${p.daysSinceFollowUp} days`);
}

function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #2A3A5C;font-size:12px;color:#5A6E96;width:45%;">${label}</td>
      <td style="padding:8px 0;border-bottom:1px solid #2A3A5C;font-size:13px;text-align:right;">${value}</td>
    </tr>
  `;
}

// ── Processor ────────────────────────────────────────────────────────────────
@Processor('emails')
export class EmailsProcessor {
  private readonly logger = new Logger(EmailsProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const mailCfg = this.configService.get('mail');

    this.transporter = nodemailer.createTransport({
      host:   mailCfg?.host   || process.env.MAIL_HOST   || 'smtp.mailtrap.io',
      port:   mailCfg?.port   || parseInt(process.env.MAIL_PORT || '587', 10),
      secure: (mailCfg?.port || parseInt(process.env.MAIL_PORT || '587', 10)) === 465,
      auth: {
        user: mailCfg?.user || process.env.MAIL_USER,
        pass: mailCfg?.pass || process.env.MAIL_PASS,
      },
    });
  }

  // ── Pre-due alert (7d / 3d / 1d before due) ────────────────────────────────
  @Process('send-pre-due-alert')
  async handlePreDueAlert(job: Job<PreDueAlertPayload>) {
    const p = job.data;
    this.logger.log(`Processing pre-due alert for invoice ${p.invoiceNumber} (${p.daysUntilDue}d)`);

    if (!p.clientEmail) {
      this.logger.warn(`No email for client on invoice ${p.invoiceNumber} — skipping`);
      return;
    }

    const urgencyLabel = p.daysUntilDue === 1 ? 'Due Tomorrow' : `Due in ${p.daysUntilDue} Days`;

    await this.sendEmail({
      to: p.clientEmail,
      subject: `[STALKER] ${urgencyLabel}: Invoice ${p.invoiceNumber} — ${fmtCurrency(p.amount)}`,
      html: preDueTemplate(p),
    });

    this.logger.log(`Pre-due alert sent to ${p.clientEmail} for ${p.invoiceNumber}`);
  }

  // ── Overdue alert ──────────────────────────────────────────────────────────
  @Process('send-overdue-alert')
  async handleOverdueAlert(job: Job<OverdueAlertPayload>) {
    const p = job.data;
    this.logger.log(`Processing overdue alert for invoice ${p.invoiceNumber}`);

    if (!p.clientEmail) {
      this.logger.warn(`No email for client on invoice ${p.invoiceNumber} — skipping`);
      return;
    }

    await this.sendEmail({
      to: p.clientEmail,
      subject: `[STALKER] OVERDUE ${p.daysOverdue}d: Invoice ${p.invoiceNumber} — ${fmtCurrency(p.amount)}`,
      html: overdueTemplate(p),
    });

    this.logger.log(`Overdue alert sent to ${p.clientEmail} for ${p.invoiceNumber}`);
  }

  // ── PDI threshold / auto-block warning ────────────────────────────────────
  @Process('send-pdi-warning')
  async handlePdiWarning(job: Job<PdiWarningPayload>) {
    const p = job.data;
    this.logger.log(`Processing PDI warning for client ${p.clientName} (PDI: ${p.pdiScore})`);

    if (!p.clientEmail) {
      this.logger.warn(`No email for client ${p.clientName} — skipping`);
      return;
    }

    const subject = p.isBlocked
      ? `[STALKER] Client Blocked: ${p.clientName} — PDI ${p.pdiScore}`
      : `[STALKER] PDI Warning: ${p.clientName} — Score ${p.pdiScore}`;

    await this.sendEmail({ to: p.clientEmail, subject, html: pdiWarningTemplate(p) });
    this.logger.log(`PDI warning sent for ${p.clientName}`);
  }

  // ── Stale follow-up alert (internal) ──────────────────────────────────────
  @Process('send-stale-followup')
  async handleStaleFollowUp(job: Job<StaleFollowUpPayload>) {
    const p = job.data;
    this.logger.log(`Processing stale follow-up alert for ${p.invoiceNumber}`);

    if (!p.assigneeEmail) {
      this.logger.warn(`No assignee email for stale follow-up ${p.invoiceNumber} — skipping`);
      return;
    }

    await this.sendEmail({
      to: p.assigneeEmail,
      subject: `[STALKER] Stale Follow-up: ${p.clientName} — ${p.daysSinceFollowUp}d no contact`,
      html: staleFollowUpTemplate(p),
    });

    this.logger.log(`Stale follow-up alert sent to ${p.assigneeEmail}`);
  }

  // ── Core send helper ───────────────────────────────────────────────────────
  private async sendEmail(opts: { to: string; subject: string; html: string }) {
    const from =
      this.configService.get('mail.from') ||
      process.env.MAIL_FROM ||
      'STALKER Cash Control <noreply@stalker-cashcontrol.com>';

    try {
      const info = await this.transporter.sendMail({
        from,
        to:      opts.to,
        subject: opts.subject,
        html:    opts.html,
      });

      this.logger.log(`Email sent: ${info.messageId}`);
      return info;
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}: ${(err as Error).message}`);
      throw err; // BullMQ will retry per the queue's backoff config
    }
  }
}
