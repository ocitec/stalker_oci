import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
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
} from './email.types';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bgPage:    '#0C0F1A',
  bgCard:    '#131929',
  bgInner:   '#1A2236',
  bgRow:     '#111827',
  border:    '#1E2D4A',
  borderSub: '#2A3A5C',
  textPrimary:   '#E8EDF8',
  textSecondary: '#8B9DC3',
  textMuted:     '#5A6E96',
  amber:  '#F59E0B',
  red:    '#F43F5E',
  green:  '#10B981',
  blue:   '#3B82F6',
  purple: '#8B5CF6',
  mono: "'SF Mono','Cascadia Code','Fira Code','Courier New',monospace",
  sans: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
};

type BadgeVariant = 'amber' | 'red' | 'green' | 'blue' | 'purple' | 'neutral';
type ButtonVariant = 'amber' | 'red' | 'green' | 'blue';

const badgeColor: Record<BadgeVariant, { bg: string; border: string; text: string }> = {
  amber:   { bg: `${C.amber}22`,  border: `${C.amber}55`,  text: C.amber  },
  red:     { bg: `${C.red}22`,    border: `${C.red}55`,    text: C.red    },
  green:   { bg: `${C.green}22`,  border: `${C.green}55`,  text: C.green  },
  blue:    { bg: `${C.blue}22`,   border: `${C.blue}55`,   text: C.blue   },
  purple:  { bg: `${C.purple}22`, border: `${C.purple}55`, text: C.purple },
  neutral: { bg: `${C.textMuted}22`, border: `${C.textMuted}55`, text: C.textMuted },
};

const buttonColor: Record<ButtonVariant, { bg: string; text: string }> = {
  amber: { bg: C.amber,  text: '#000' },
  red:   { bg: C.red,    text: '#fff' },
  green: { bg: C.green,  text: '#fff' },
  blue:  { bg: C.blue,   text: '#fff' },
};

// ── Shared helpers ─────────────────────────────────────────────────────────────
function fmtCurrency(value: number | string, currency = 'NGN'): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency, minimumFractionDigits: 0,
  }).format(isNaN(n) ? 0 : n);
}

function fmtDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function today(): string {
  return new Date().toLocaleDateString('en-NG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Design System Components ───────────────────────────────────────────────────

function badge(label: string, variant: BadgeVariant, icon = ''): string {
  const { bg, border, text } = badgeColor[variant];
  return `
    <div style="display:inline-block;background:${bg};border:1px solid ${border};border-radius:6px;padding:4px 12px;margin-bottom:20px;">
      <span style="font-family:${C.mono};font-size:11px;font-weight:700;color:${text};letter-spacing:0.06em;">${icon ? icon + ' ' : ''}${label}</span>
    </div>`;
}

function headline(text: string, sub?: string): string {
  return `
    <h1 style="margin:0 0 ${sub ? '6px' : '24px'} 0;font-size:22px;font-weight:700;color:${C.textPrimary};line-height:1.3;font-family:${C.sans};">${text}</h1>
    ${sub ? `<p style="margin:0 0 24px 0;font-size:14px;color:${C.textSecondary};line-height:1.6;">${sub}</p>` : ''}`;
}

function detailRow(label: string, value: string, last = false): string {
  return `
    <tr>
      <td style="padding:10px 0;${last ? '' : `border-bottom:1px solid ${C.borderSub};`}font-size:12px;color:${C.textMuted};width:42%;vertical-align:middle;">${label}</td>
      <td style="padding:10px 0;${last ? '' : `border-bottom:1px solid ${C.borderSub};`}font-size:13px;text-align:right;vertical-align:middle;">${value}</td>
    </tr>`;
}

function detailTable(rows: Array<[string, string]>, borderColor = C.borderSub): string {
  const rowsHtml = rows.map(([label, value], i) =>
    detailRow(label, value, i === rows.length - 1),
  ).join('');
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bgInner};border:1px solid ${borderColor};border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
      </td></tr>
    </table>`;
}

function ctaButton(label: string, url: string, variant: ButtonVariant = 'amber'): string {
  const { bg, text } = buttonColor[variant];
  return `
    <div style="text-align:center;margin-top:24px;">
      <a href="${url}" style="display:inline-block;background:${bg};color:${text};font-family:${C.sans};font-size:13px;font-weight:700;padding:13px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">${label} →</a>
    </div>`;
}

function infoBox(content: string, variant: BadgeVariant = 'blue'): string {
  const { bg, border, text } = badgeColor[variant];
  return `
    <div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:14px 18px;margin-bottom:24px;">
      <p style="margin:0;font-size:12px;color:${text};line-height:1.7;">${content}</p>
    </div>`;
}

function metricPill(value: string, label: string, color: string): string {
  return `
    <td style="text-align:center;padding:0 12px;">
      <div style="font-family:${C.mono};font-size:28px;font-weight:700;color:${color};">${value}</div>
      <div style="font-size:11px;color:${C.textMuted};margin-top:4px;letter-spacing:0.04em;">${label}</div>
    </td>`;
}

function metricsRow(pills: Array<{ value: string; label: string; color: string }>): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bgInner};border:1px solid ${C.borderSub};border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>${pills.map(p => metricPill(p.value, p.label, p.color)).join('<td style="width:1px;background:' + C.borderSub + ';"></td>')}</tr>
        </table>
      </td></tr>
    </table>`;
}

function sectionHeader(title: string): string {
  return `<p style="margin:20px 0 10px 0;font-family:${C.mono};font-size:10px;font-weight:700;color:${C.textMuted};letter-spacing:0.1em;text-transform:uppercase;">${title}</p>`;
}

function listTable(rows: Array<{ name: string; value: string }>, color = C.textPrimary): string {
  if (!rows.length) return `<p style="color:${C.textMuted};font-size:12px;">None this period.</p>`;
  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid ${C.borderSub};font-size:13px;color:${C.textPrimary};">${r.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid ${C.borderSub};font-size:13px;color:${color};text-align:right;font-family:${C.mono};">${r.value}</td>
    </tr>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>`;
}

function brandHeader(): string {
  return `
    <tr>
      <td style="padding:0 0 28px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="font-family:${C.mono};font-size:17px;font-weight:700;color:${C.amber};letter-spacing:0.1em;">STALKER</span>
              <span style="font-size:11px;color:${C.textMuted};margin-left:8px;font-family:${C.sans};">Cash Control Intelligence</span>
            </td>
            <td align="right">
              <span style="font-size:10px;color:${C.textMuted};font-family:${C.mono};">${today()}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function footer(): string {
  return `
    <tr>
      <td style="padding:24px 0 0 0;text-align:center;border-top:1px solid ${C.border};margin-top:8px;">
        <p style="margin:0 0 6px 0;font-size:10px;color:${C.textMuted};line-height:1.6;font-family:${C.sans};">
          This is an automated notification from <strong style="color:${C.amber};">STALKER</strong> Cash Control Intelligence.
        </p>
        <p style="margin:0;font-size:10px;color:${C.textMuted};font-family:${C.sans};">
          Do not reply to this email. Log in to the dashboard to manage notifications.
        </p>
      </td>
    </tr>`;
}

function baseLayout(content: string, previewText: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>STALKER — Cash Control</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:${C.bgPage};font-family:${C.sans};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;color:${C.bgPage};">${previewText}&nbsp;‌&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bgPage};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        ${brandHeader()}
        <tr>
          <td style="background:${C.bgCard};border:1px solid ${C.border};border-radius:12px;padding:32px;">
            ${content}
          </td>
        </tr>
        ${footer()}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Template service ───────────────────────────────────────────────────────────
@Injectable()
export class EmailTemplateService {
  private readonly dashboardUrl: string;

  constructor(private readonly config: ConfigService) {
    this.dashboardUrl = config.get('frontend.url') || 'http://localhost:3000';
  }

  // ── Client: Invoice Created ────────────────────────────────────────────────
  invoiceCreated(p: InvoiceCreatedPayload): { subject: string; html: string } {
    const subject = `New Invoice: ${p.invoiceNumber} — ${fmtCurrency(p.amount, p.currency)}`;
    const content = `
      ${badge('NEW INVOICE', 'blue', '📄')}
      ${headline('You have a new invoice', `Please review and arrange payment before the due date.`)}
      ${detailTable([
        ['Client', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['Invoice No.', `<code style="font-family:${C.mono};color:${C.amber};">${p.invoiceNumber}</code>`],
        ['Invoice Date', `<span style="color:${C.textSecondary};">${fmtDate(p.invoiceDate)}</span>`],
        ['Due Date', `<strong style="color:${C.amber};">${fmtDate(p.dueDate)}</strong>`],
        ['Amount Due', `<strong style="font-family:${C.mono};font-size:16px;color:${C.textPrimary};">${fmtCurrency(p.amount, p.currency)}</strong>`],
        ['Currency', `<span style="color:${C.textSecondary};">${p.currency}</span>`],
      ])}
      ${p.notes ? infoBox(`<strong>Note:</strong> ${p.notes}`, 'neutral') : ''}
      ${infoBox(`Payment is due on <strong>${fmtDate(p.dueDate)}</strong>. Please contact us if you have any questions about this invoice.`, 'blue')}
      ${ctaButton('View Invoice Details', `${this.dashboardUrl}/dashboard/invoices`, 'amber')}`;
    return { subject, html: baseLayout(content, `New Invoice ${p.invoiceNumber} — ${fmtCurrency(p.amount, p.currency)} due ${fmtDate(p.dueDate)}`) };
  }

  // ── Client: Full Payment Receipt ──────────────────────────────────────────
  paymentReceipt(p: PaymentReceiptPayload): { subject: string; html: string } {
    const subject = `Payment Received: ${p.invoiceNumber} — ${fmtCurrency(p.amountPaid)}`;
    const content = `
      ${badge('PAYMENT CONFIRMED', 'green', '✅')}
      ${headline('Payment Received in Full', `Thank you — your invoice has been fully settled.`)}
      ${detailTable([
        ['Client', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['Invoice No.', `<code style="font-family:${C.mono};color:${C.amber};">${p.invoiceNumber}</code>`],
        ['Amount Paid', `<strong style="font-family:${C.mono};font-size:16px;color:${C.green};">${fmtCurrency(p.amountPaid)}</strong>`],
        ['Invoice Total', `<span style="color:${C.textSecondary};">${fmtCurrency(p.totalAmount)}</span>`],
        ['Payment Date', `<span style="color:${C.textSecondary};">${fmtDate(p.paymentDate)}</span>`],
        ['Outstanding', `<strong style="font-family:${C.mono};color:${C.green};">₦0.00</strong>`],
      ], `${C.green}33`)}
      ${infoBox('This invoice is now fully paid. Please keep this confirmation for your records.', 'green')}`;
    return { subject, html: baseLayout(content, `Payment confirmed for invoice ${p.invoiceNumber}`) };
  }

  // ── Client: Partial Payment Acknowledgement ────────────────────────────────
  partialPaymentReceipt(p: PartialPaymentReceiptPayload): { subject: string; html: string } {
    const subject = `Partial Payment Received: ${p.invoiceNumber}`;
    const pct = Math.round((Number(p.amountPaid) / Number(p.totalAmount)) * 100);
    const content = `
      ${badge('PARTIAL PAYMENT RECEIVED', 'blue', '💳')}
      ${headline('Partial Payment Acknowledged', `We have received a partial payment on invoice ${p.invoiceNumber}.`)}
      ${detailTable([
        ['Client', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['Invoice No.', `<code style="font-family:${C.mono};color:${C.amber};">${p.invoiceNumber}</code>`],
        ['Invoice Total', `<span style="color:${C.textSecondary};">${fmtCurrency(p.totalAmount)}</span>`],
        ['Amount Paid', `<strong style="font-family:${C.mono};font-size:15px;color:${C.blue};">${fmtCurrency(p.amountPaid)}</strong>`],
        ['Remaining Balance', `<strong style="font-family:${C.mono};font-size:15px;color:${C.amber};">${fmtCurrency(p.remainingBalance)}</strong>`],
        ['Payment Date', `<span style="color:${C.textSecondary};">${fmtDate(p.paymentDate)}</span>`],
      ])}
      <div style="background:${C.bgInner};border-radius:6px;height:8px;margin-bottom:20px;overflow:hidden;">
        <div style="background:${C.blue};height:100%;width:${pct}%;border-radius:6px;"></div>
      </div>
      <p style="text-align:center;font-size:12px;color:${C.textMuted};margin:0 0 20px 0;">${pct}% paid — ${fmtCurrency(p.remainingBalance)} outstanding</p>
      ${infoBox(`The remaining balance of <strong>${fmtCurrency(p.remainingBalance)}</strong> is still outstanding. Please arrange payment at your earliest convenience.`, 'amber')}`;
    return { subject, html: baseLayout(content, `Partial payment received on ${p.invoiceNumber} — ${fmtCurrency(p.remainingBalance)} remaining`) };
  }

  // ── Client: Pre-Due Alert ──────────────────────────────────────────────────
  preDueAlert(p: PreDueAlertPayload): { subject: string; html: string } {
    const urgencyLabel = p.daysUntilDue === 1 ? 'Due Tomorrow' : `Due in ${p.daysUntilDue} Days`;
    const variant: BadgeVariant = p.daysUntilDue <= 1 ? 'red' : p.daysUntilDue <= 3 ? 'amber' : 'blue';
    const accentColor = { red: C.red, amber: C.amber, blue: C.blue, green: C.green, purple: C.purple, neutral: C.textMuted }[variant];
    const subject = `[Action Required] ${urgencyLabel}: Invoice ${p.invoiceNumber} — ${fmtCurrency(p.amount)}`;
    const barWidth = Math.max(10, 100 - (p.daysUntilDue / 7) * 100);
    const content = `
      ${badge(urgencyLabel.toUpperCase(), variant, '⏰')}
      ${headline('Invoice Due Soon', `A payment is approaching its due date. Please arrange settlement immediately.`)}
      ${detailTable([
        ['Client', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['Invoice No.', `<code style="font-family:${C.mono};color:${C.amber};">${p.invoiceNumber}</code>`],
        ['Amount Due', `<strong style="font-family:${C.mono};font-size:16px;color:${C.textPrimary};">${fmtCurrency(p.amount)}</strong>`],
        ['Due Date', `<strong style="color:${accentColor};">${fmtDate(p.dueDate)}</strong>`],
        ['Days Remaining', `<strong style="font-family:${C.mono};font-size:20px;color:${accentColor};">${p.daysUntilDue}d</strong>`],
      ], `${accentColor}33`)}
      <div style="background:${C.bgInner};border-radius:4px;height:6px;margin-bottom:20px;overflow:hidden;">
        <div style="background:${accentColor};height:100%;width:${barWidth}%;border-radius:4px;"></div>
      </div>
      ${ctaButton('View Invoice', `${this.dashboardUrl}/dashboard/invoices`, variant === 'red' ? 'red' : variant === 'amber' ? 'amber' : 'blue')}`;
    return { subject, html: baseLayout(content, `${urgencyLabel}: ${p.invoiceNumber} — ${fmtCurrency(p.amount)} from ${p.clientName}`) };
  }

  // ── Client: Overdue Alert ─────────────────────────────────────────────────
  overdueAlert(p: OverdueAlertPayload): { subject: string; html: string } {
    const subject = `[OVERDUE ${p.daysOverdue}d] Invoice ${p.invoiceNumber} — ${fmtCurrency(p.amount)}`;
    const content = `
      ${badge(`OVERDUE — ${p.daysOverdue} DAYS PAST DUE`, 'red', '🚨')}
      ${headline('Invoice Overdue', `This invoice has not been settled and is now ${p.daysOverdue} day(s) past its due date.`)}
      ${detailTable([
        ['Client', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['Invoice No.', `<code style="font-family:${C.mono};color:${C.amber};">${p.invoiceNumber}</code>`],
        ['Amount Outstanding', `<strong style="font-family:${C.mono};font-size:16px;color:${C.red};">${fmtCurrency(p.amount)}</strong>`],
        ['Original Due Date', `<span style="color:${C.textSecondary};">${fmtDate(p.dueDate)}</span>`],
        ['Days Overdue', `<strong style="font-family:${C.mono};font-size:20px;color:${C.red};">${p.daysOverdue}d</strong>`],
      ], `${C.red}33`)}
      ${infoBox('⚠️ Continued non-payment may affect your credit standing and access to future services. Please settle this invoice immediately.', 'red')}
      ${ctaButton('Settle Now', `${this.dashboardUrl}/dashboard/invoices`, 'red')}`;
    return { subject, html: baseLayout(content, `OVERDUE: ${p.invoiceNumber} — ${fmtCurrency(p.amount)} is ${p.daysOverdue}d past due`) };
  }

  // ── Client: Account Blocked ────────────────────────────────────────────────
  accountBlocked(p: AccountBlockedPayload): { subject: string; html: string } {
    const subject = `Account Notice: Credit Access Suspended — ${p.clientName}`;
    const content = `
      ${badge(p.isAutoBlock ? 'ACCOUNT AUTO-BLOCKED' : 'ACCOUNT SUSPENDED', 'red', '🔒')}
      ${headline('Credit Access Suspended', `Your account has been ${p.isAutoBlock ? 'automatically blocked' : 'suspended'} from receiving new credit.`)}
      ${detailTable([
        ['Account', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['Status', `<strong style="color:${C.red};">BLOCKED</strong>`],
        ...(p.pdiScore !== undefined ? [['Payment Discipline Index', `<strong style="font-family:${C.mono};font-size:16px;color:${C.red};">${p.pdiScore}</strong>` as string] as [string, string]] : []),
        ['Reason', `<span style="color:${C.textSecondary};">${p.blockedReason}</span>`],
      ], `${C.red}33`)}
      ${infoBox('⚠️ While your account is blocked, new invoices cannot be issued. To resolve this, please settle all outstanding balances and contact your account manager.', 'red')}`;
    return { subject, html: baseLayout(content, `Credit access suspended for ${p.clientName}`) };
  }

  // ── Client: Account Unblocked ──────────────────────────────────────────────
  accountUnblocked(p: AccountUnblockedPayload): { subject: string; html: string } {
    const subject = `Account Reinstated: Credit Access Restored — ${p.clientName}`;
    const content = `
      ${badge('ACCOUNT REINSTATED', 'green', '🔓')}
      ${headline('Credit Access Restored', `Your account has been reviewed and credit access has been reinstated.`)}
      ${detailTable([
        ['Account', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['Status', `<strong style="color:${C.green};">ACTIVE</strong>`],
        ['Effective Date', `<span style="color:${C.textSecondary};">${fmtDate(new Date())}</span>`],
      ], `${C.green}33`)}
      ${infoBox('Your account is now in good standing. Please maintain timely payments to preserve your credit rating.', 'green')}`;
    return { subject, html: baseLayout(content, `Account reinstated for ${p.clientName}`) };
  }

  // ── Internal: PDI Warning ──────────────────────────────────────────────────
  pdiWarning(p: PdiWarningPayload): { subject: string; html: string } {
    const subject = p.isBlocked
      ? `[BLOCKED] ${p.clientName} — PDI ${p.pdiScore} | Auto-block triggered`
      : `[PDI WARNING] ${p.clientName} — Score ${p.pdiScore}`;
    const variant: BadgeVariant = p.isBlocked ? 'red' : 'amber';
    const content = `
      ${badge(p.isBlocked ? 'CLIENT AUTO-BLOCKED' : 'PDI THRESHOLD WARNING', variant, '🛡')}
      ${headline(`PDI Alert: ${p.clientName}`, p.isBlocked
        ? `PDI has dropped below 30 and the client has been automatically blocked from new credit.`
        : `PDI has fallen to a concerning level and requires CFO review.`)}
      ${metricsRow([
        { value: String(p.pdiScore), label: 'CURRENT PDI', color: p.isBlocked ? C.red : C.amber },
        { value: '30', label: 'BLOCK THRESHOLD', color: C.textMuted },
        { value: p.isBlocked ? 'BLOCKED' : 'AT RISK', label: 'STATUS', color: p.isBlocked ? C.red : C.amber },
      ])}
      ${detailTable([
        ['Client', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['PDI Score', `<strong style="font-family:${C.mono};font-size:18px;color:${p.isBlocked ? C.red : C.amber};">${p.pdiScore}</strong>`],
        ['Auto-block Threshold', `<span style="font-family:${C.mono};color:${C.textMuted};">30</span>`],
        ['Block Status', `<strong style="color:${p.isBlocked ? C.red : C.green};">${p.isBlocked ? 'BLOCKED' : 'ACTIVE'}</strong>`],
      ])}
      ${ctaButton('Review Client Profile', `${this.dashboardUrl}/dashboard/clients`, variant === 'red' ? 'red' : 'amber')}`;
    return { subject, html: baseLayout(content, `PDI Alert: ${p.clientName} — Score ${p.pdiScore}${p.isBlocked ? ' (Blocked)' : ''}`) };
  }

  // ── Finance: Payment Confirmation ──────────────────────────────────────────
  paymentConfirmation(p: PaymentConfirmationPayload): { subject: string; html: string } {
    const subject = p.isFullyPaid
      ? `[PAID] Invoice ${p.invoiceNumber} — ${fmtCurrency(p.amountPaid)} received`
      : `[PARTIAL] Invoice ${p.invoiceNumber} — ${fmtCurrency(p.amountPaid)} received`;
    const variant: BadgeVariant = p.isFullyPaid ? 'green' : 'blue';
    const content = `
      ${badge(p.isFullyPaid ? 'PAYMENT RECEIVED — FULLY PAID' : 'PARTIAL PAYMENT RECORDED', variant, '💰')}
      ${headline('Payment Recorded', `A payment has been recorded on ${p.invoiceNumber} for client ${p.clientName}.`)}
      ${detailTable([
        ['Client', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['Invoice No.', `<code style="font-family:${C.mono};color:${C.amber};">${p.invoiceNumber}</code>`],
        ['Amount Paid', `<strong style="font-family:${C.mono};font-size:16px;color:${p.isFullyPaid ? C.green : C.blue};">${fmtCurrency(p.amountPaid)}</strong>`],
        ['Remaining Balance', `<strong style="font-family:${C.mono};color:${p.isFullyPaid ? C.green : C.amber};">${p.isFullyPaid ? '₦0.00' : fmtCurrency(p.remainingBalance)}</strong>`],
        ['Payment Date', `<span style="color:${C.textSecondary};">${fmtDate(p.paymentDate)}</span>`],
        ...(p.recordedBy ? [['Recorded By', `<span style="color:${C.textSecondary};">${p.recordedBy}</span>`] as [string, string]] : []),
        ['Status', `<strong style="color:${p.isFullyPaid ? C.green : C.blue};">${p.isFullyPaid ? 'FULLY PAID' : 'PARTIALLY PAID'}</strong>`],
      ])}
      ${ctaButton('View Invoice', `${this.dashboardUrl}/dashboard/invoices`, p.isFullyPaid ? 'green' : 'blue')}`;
    return { subject, html: baseLayout(content, `Payment ${p.isFullyPaid ? 'received' : 'partial'}: ${p.invoiceNumber} — ${fmtCurrency(p.amountPaid)}`) };
  }

  // ── Finance: Payment Reverted (CFO Alert) ─────────────────────────────────
  paymentReverted(p: PaymentRevertedPayload): { subject: string; html: string } {
    const subject = `[AUDIT ALERT] Payment Reverted: ${p.invoiceNumber} — ${fmtCurrency(p.revertedAmount)}`;
    const content = `
      ${badge('PAYMENT REVERSAL — AUDIT REQUIRED', 'red', '⚠️')}
      ${headline('Payment Reverted', `A recorded payment has been reversed on invoice ${p.invoiceNumber}.`)}
      ${detailTable([
        ['Client', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['Invoice No.', `<code style="font-family:${C.mono};color:${C.amber};">${p.invoiceNumber}</code>`],
        ['Reverted Amount', `<strong style="font-family:${C.mono};font-size:16px;color:${C.red};">${fmtCurrency(p.revertedAmount)}</strong>`],
        ['Restored Status', `<strong style="color:${p.restoredStatus === 'OVERDUE' ? C.red : C.amber};">${p.restoredStatus}</strong>`],
        ['Reversed At', `<span style="color:${C.textSecondary};">${fmtDateTime(new Date())}</span>`],
        ...(p.revertedBy ? [['Reversed By', `<span style="color:${C.textSecondary};">${p.revertedBy}</span>`] as [string, string]] : []),
      ], `${C.red}33`)}
      ${infoBox('⚠️ This action requires review. A payment reversal changes the invoice status and may reopen SLA violations. Verify this action is authorised.', 'red')}
      ${ctaButton('Review Audit Log', `${this.dashboardUrl}/dashboard/invoices`, 'red')}`;
    return { subject, html: baseLayout(content, `Payment reverted on ${p.invoiceNumber} — ${fmtCurrency(p.revertedAmount)}`) };
  }

  // ── Finance: Credit Limit Breached ────────────────────────────────────────
  creditLimitBreached(p: CreditLimitBreachedPayload): { subject: string; html: string } {
    const subject = `[CREDIT ALERT] ${p.clientName} — Credit Limit at ${p.utilizationPercent}% utilisation`;
    const barColor = p.utilizationPercent >= 100 ? C.red : C.amber;
    const content = `
      ${badge(`CREDIT LIMIT ${p.utilizationPercent >= 100 ? 'EXCEEDED' : 'NEAR LIMIT'}`, p.utilizationPercent >= 100 ? 'red' : 'amber', '📊')}
      ${headline('Credit Limit Alert', `${p.clientName}'s outstanding balance has reached ${p.utilizationPercent}% of their approved credit limit.`)}
      ${metricsRow([
        { value: fmtCurrency(p.currentOutstanding), label: 'OUTSTANDING', color: barColor },
        { value: fmtCurrency(p.creditLimit), label: 'CREDIT LIMIT', color: C.textMuted },
        { value: `${p.utilizationPercent}%`, label: 'UTILISATION', color: barColor },
      ])}
      <div style="background:${C.bgInner};border-radius:4px;height:8px;margin-bottom:8px;overflow:hidden;">
        <div style="background:${barColor};height:100%;width:${Math.min(100, p.utilizationPercent)}%;border-radius:4px;"></div>
      </div>
      <p style="text-align:center;font-size:11px;color:${barColor};margin:0 0 20px 0;font-family:${C.mono};">${p.utilizationPercent}% of credit limit used</p>
      ${detailTable([
        ['Client', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['Invoice', `<code style="font-family:${C.mono};color:${C.amber};">${p.invoiceNumber}</code>`],
        ['Credit Limit', `<strong style="font-family:${C.mono};">${fmtCurrency(p.creditLimit)}</strong>`],
        ['Outstanding', `<strong style="font-family:${C.mono};color:${barColor};">${fmtCurrency(p.currentOutstanding)}</strong>`],
      ])}
      ${ctaButton('Review Client Credit', `${this.dashboardUrl}/dashboard/clients`, p.utilizationPercent >= 100 ? 'red' : 'amber')}`;
    return { subject, html: baseLayout(content, `Credit limit alert: ${p.clientName} at ${p.utilizationPercent}% utilisation`) };
  }

  // ── Finance: Risk Status Changed ──────────────────────────────────────────
  riskStatusChanged(p: RiskStatusChangedPayload): { subject: string; html: string } {
    const isWorse = ['MODERATE', 'HIGH_RISK', 'CHRONIC'].indexOf(p.newRisk) >
                    ['MODERATE', 'HIGH_RISK', 'CHRONIC'].indexOf(p.previousRisk);
    const variant: BadgeVariant = p.newRisk === 'CHRONIC' ? 'red' : p.newRisk === 'HIGH_RISK' ? 'amber' : 'green';
    const subject = `[RISK CHANGE] ${p.clientName}: ${p.previousRisk} → ${p.newRisk}`;
    const riskColor = (r: string) => ({ RELIABLE: C.green, MODERATE: C.blue, HIGH_RISK: C.amber, CHRONIC: C.red }[r] || C.textMuted);
    const content = `
      ${badge(`RISK STATUS ${isWorse ? 'DOWNGRADED' : 'UPGRADED'}`, variant, isWorse ? '📉' : '📈')}
      ${headline(`Risk Status Changed: ${p.clientName}`, `This client's payment risk classification has been updated.`)}
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:48%;background:${C.bgInner};border:1px solid ${riskColor(p.previousRisk)}33;border-radius:8px;padding:16px;text-align:center;">
              <div style="font-size:10px;color:${C.textMuted};margin-bottom:6px;font-family:${C.mono};">PREVIOUS</div>
              <div style="font-weight:700;color:${riskColor(p.previousRisk)};font-size:15px;">${p.previousRisk.replace('_', ' ')}</div>
            </td>
            <td style="width:4%;text-align:center;color:${C.textMuted};font-size:18px;">→</td>
            <td style="width:48%;background:${C.bgInner};border:1px solid ${riskColor(p.newRisk)}33;border-radius:8px;padding:16px;text-align:center;">
              <div style="font-size:10px;color:${C.textMuted};margin-bottom:6px;font-family:${C.mono};">NEW</div>
              <div style="font-weight:700;color:${riskColor(p.newRisk)};font-size:15px;">${p.newRisk.replace('_', ' ')}</div>
            </td>
          </tr>
        </table>
      </div>
      ${detailTable([
        ['Client', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['PDI Score', `<strong style="font-family:${C.mono};font-size:16px;color:${riskColor(p.newRisk)};">${p.pdiScore}</strong>`],
        ['Date', `<span style="color:${C.textSecondary};">${fmtDate(new Date())}</span>`],
      ])}
      ${ctaButton('Review Client', `${this.dashboardUrl}/dashboard/clients`, variant === 'red' ? 'red' : variant === 'amber' ? 'amber' : 'green')}`;
    return { subject, html: baseLayout(content, `Risk change: ${p.clientName} moved from ${p.previousRisk} to ${p.newRisk}`) };
  }

  // ── Finance: Chronic Client Escalation ───────────────────────────────────
  chronicClient(p: ChronicClientPayload): { subject: string; html: string } {
    const subject = `[ESCALATION] Chronic Client: ${p.clientName} — PDI ${p.pdiScore}`;
    const content = `
      ${badge('CHRONIC DELAYER — CFO ESCALATION', 'red', '🔴')}
      ${headline(`Chronic Client: ${p.clientName}`, `This client's payment behaviour has been classified as CHRONIC and requires immediate CFO review.`)}
      ${metricsRow([
        { value: String(p.pdiScore), label: 'PDI SCORE', color: C.red },
        { value: String(p.totalViolations), label: 'SLA VIOLATIONS', color: C.amber },
        { value: 'CHRONIC', label: 'RISK CLASS', color: C.red },
      ])}
      ${infoBox('🔴 A CHRONIC classification indicates a pattern of persistent late payment. Recommended actions: restrict credit terms, escalate collection, or initiate formal recovery proceedings.', 'red')}
      ${ctaButton('Manage Client', `${this.dashboardUrl}/dashboard/clients`, 'red')}`;
    return { subject, html: baseLayout(content, `Chronic delayer: ${p.clientName} — PDI ${p.pdiScore}, ${p.totalViolations} violations`) };
  }

  // ── Finance: New SLA Violation ────────────────────────────────────────────
  newSlaViolation(p: NewSlaViolationPayload): { subject: string; html: string } {
    const subject = `[SLA BREACH] ${p.clientName} — Invoice ${p.invoiceNumber} overdue ${p.daysLate}d`;
    const content = `
      ${badge(`SLA VIOLATION — ${p.daysLate} DAYS LATE`, 'red', '🚫')}
      ${headline('SLA Breach Detected', `A new SLA violation has been recorded. Immediate follow-up is required.`)}
      ${detailTable([
        ['Client', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['Invoice No.', `<code style="font-family:${C.mono};color:${C.amber};">${p.invoiceNumber}</code>`],
        ['Amount Overdue', `<strong style="font-family:${C.mono};font-size:16px;color:${C.red};">${fmtCurrency(p.amount)}</strong>`],
        ['Original Due Date', `<span style="color:${C.textSecondary};">${fmtDate(p.dueDate)}</span>`],
        ['Days Late', `<strong style="font-family:${C.mono};font-size:20px;color:${C.red};">${p.daysLate}d</strong>`],
      ], `${C.red}33`)}
      ${infoBox('Log a follow-up action immediately to maintain collection momentum and protect your PDI metrics.', 'amber')}
      ${ctaButton('Log Follow-up', `${this.dashboardUrl}/dashboard/followups`, 'amber')}`;
    return { subject, html: baseLayout(content, `SLA breach: ${p.clientName} — ${p.invoiceNumber} is ${p.daysLate} days overdue`) };
  }

  // ── Admin: Client Blocked Audit ───────────────────────────────────────────
  clientBlockedAudit(p: ClientBlockedAuditPayload): { subject: string; html: string } {
    const subject = `[AUDIT] Client Blocked: ${p.clientName}`;
    const content = `
      ${badge('CLIENT BLOCK — AUDIT LOG', 'red', '🔐')}
      ${headline('Client Manually Blocked', `An admin action has blocked ${p.clientName} from receiving new credit.`)}
      ${detailTable([
        ['Client', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['Action', `<strong style="color:${C.red};">BLOCKED</strong>`],
        ['Reason', `<span style="color:${C.textSecondary};">${p.blockedReason}</span>`],
        ...(p.blockedBy ? [['Actioned By', `<span style="color:${C.textSecondary};">${p.blockedBy}</span>`] as [string, string]] : []),
        ['Timestamp', `<span style="color:${C.textSecondary};">${fmtDateTime(new Date())}</span>`],
      ])}
      ${infoBox('This is an automated audit notification. Please ensure this action is documented appropriately.', 'neutral')}`;
    return { subject, html: baseLayout(content, `Audit: ${p.clientName} blocked by admin`) };
  }

  // ── Internal: Stale Follow-up ─────────────────────────────────────────────
  staleFollowUp(p: StaleFollowUpPayload): { subject: string; html: string } {
    const subject = `[ACTION NEEDED] No follow-up for ${p.daysSinceFollowUp} days: ${p.clientName} — ${p.invoiceNumber}`;
    const content = `
      ${badge(`FOLLOW-UP STALE — ${p.daysSinceFollowUp} DAYS`, 'amber', '⏱')}
      ${headline('Stale Follow-up Alert', `An overdue invoice has had no follow-up contact in ${p.daysSinceFollowUp} days. Contact the client immediately.`)}
      ${detailTable([
        ['Client', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ['Invoice No.', `<code style="font-family:${C.mono};color:${C.amber};">${p.invoiceNumber}</code>`],
        ['Amount', `<strong style="font-family:${C.mono};color:${C.textPrimary};">${fmtCurrency(p.amount)}</strong>`],
        ['Days Since Contact', `<strong style="font-family:${C.mono};font-size:20px;color:${C.amber};">${p.daysSinceFollowUp}d</strong>`],
      ])}
      ${infoBox('Log a follow-up action now to reset the clock and maintain collection momentum.', 'amber')}
      ${ctaButton('Log Follow-up Now', `${this.dashboardUrl}/dashboard/followups`, 'amber')}`;
    return { subject, html: baseLayout(content, `Stale follow-up: ${p.invoiceNumber} — ${p.daysSinceFollowUp} days no contact`) };
  }

  // ── CFO: Weekly Report ────────────────────────────────────────────────────
  weeklyCfoReport(p: WeeklyCfoReportPayload): { subject: string; html: string } {
    const subject = `[Weekly Report] ${p.organizationName} — Cash Control Digest ${fmtDate(p.period.to)}`;
    const content = `
      ${badge('WEEKLY CFO DIGEST', 'amber', '📊')}
      ${headline(`Weekly Summary: ${p.organizationName}`, `${fmtDate(p.period.from)} — ${fmtDate(p.period.to)}`)}
      ${metricsRow([
        { value: fmtCurrency(p.kpis.collectedThisWeek), label: 'COLLECTED', color: C.green },
        { value: String(p.kpis.newOverdueInvoices), label: 'NEW OVERDUE', color: C.red },
        { value: `${p.kpis.currentDso}d`, label: 'CURRENT DSO', color: p.kpis.currentDso > 45 ? C.amber : C.blue },
      ])}
      ${sectionHeader('Key Metrics')}
      ${detailTable([
        ['Total Outstanding', `<strong style="font-family:${C.mono};color:${C.textPrimary};">${fmtCurrency(p.kpis.totalOutstanding)}</strong>`],
        ['Collected This Week', `<strong style="font-family:${C.mono};color:${C.green};">${fmtCurrency(p.kpis.collectedThisWeek)}</strong>`],
        ['New Overdue Invoices', `<strong style="color:${p.kpis.newOverdueInvoices > 0 ? C.red : C.green};">${p.kpis.newOverdueInvoices}</strong>`],
        ['New SLA Violations', `<strong style="color:${p.newSlaViolations > 0 ? C.red : C.green};">${p.newSlaViolations}</strong>`],
        ['Follow-ups Logged', `<strong style="color:${C.blue};">${p.kpis.followUpsLogged}</strong>`],
        ['Days Sales Outstanding', `<strong style="font-family:${C.mono};color:${p.kpis.currentDso > 45 ? C.amber : C.blue};">${p.kpis.currentDso}d</strong>`],
      ])}
      ${p.chronicClients.length > 0 ? `
        ${sectionHeader('Chronic Clients Requiring Action')}
        <div style="background:${C.bgInner};border:1px solid ${C.red}33;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
          ${listTable(p.chronicClients.map(c => ({ name: c.name, value: `PDI ${c.pdi}` })), C.red)}
        </div>` : ''}
      ${p.topOverdueClients.length > 0 ? `
        ${sectionHeader('Top Outstanding Balances')}
        <div style="background:${C.bgInner};border:1px solid ${C.borderSub};border-radius:8px;padding:16px 20px;margin-bottom:20px;">
          ${listTable(p.topOverdueClients.map(c => ({ name: c.name, value: fmtCurrency(c.amount) })), C.amber)}
        </div>` : ''}
      ${p.riskChanges.length > 0 ? `
        ${sectionHeader('Risk Status Changes This Week')}
        <div style="background:${C.bgInner};border:1px solid ${C.borderSub};border-radius:8px;padding:16px 20px;margin-bottom:20px;">
          ${listTable(p.riskChanges.map(c => ({ name: c.name, value: `${c.from} → ${c.to}` })), C.amber)}
        </div>` : ''}
      ${ctaButton('Open Dashboard', `${this.dashboardUrl}/dashboard`, 'amber')}`;
    return { subject, html: baseLayout(content, `Weekly CFO digest for ${p.organizationName} — week of ${fmtDate(p.period.to)}`) };
  }

  // ── Operational: New Client Onboarded ────────────────────────────────────
  newClientOnboarded(p: NewClientOnboardedPayload): { subject: string; html: string } {
    const subject = `[New Client] ${p.clientName} onboarded — ${p.organizationName}`;
    const content = `
      ${badge('NEW CLIENT ONBOARDED', 'green', '🏢')}
      ${headline(`New Client: ${p.clientName}`, `A new client has been added to the system and is ready for invoicing.`)}
      ${detailTable([
        ['Client Name', `<strong style="color:${C.textPrimary};">${p.clientName}</strong>`],
        ...(p.sector ? [['Sector', `<span style="color:${C.textSecondary};">${p.sector}</span>`] as [string, string]] : []),
        ['Credit Limit', `<strong style="font-family:${C.mono};color:${C.textPrimary};">${fmtCurrency(p.creditLimit)}</strong>`],
        ['Payment Terms', `<strong style="color:${C.blue};">${p.slaDays} days</strong>`],
        ['Onboarded', `<span style="color:${C.textSecondary};">${fmtDate(new Date())}</span>`],
      ])}
      ${infoBox('Ensure credit terms have been reviewed and documented before issuing the first invoice.', 'blue')}
      ${ctaButton('View Client', `${this.dashboardUrl}/dashboard/clients`, 'green')}`;
    return { subject, html: baseLayout(content, `New client onboarded: ${p.clientName} with ${p.slaDays}-day terms`) };
  }

  // ── Operational: Welcome User ─────────────────────────────────────────────
  welcomeUser(p: WelcomeUserPayload): { subject: string; html: string } {
    const subject = `Welcome to STALKER — Your account is ready, ${p.userName}`;
    const roleDesc: Record<string, string> = {
      ADMIN: 'Full system access including user management and configuration',
      CFO: 'Executive dashboard, analytics, and financial reporting',
      FINANCE: 'Invoice management, payment recording, and client monitoring',
      SALES: 'Client and invoice visibility with read-only access',
    };
    const content = `
      ${badge('WELCOME TO STALKER', 'amber', '👋')}
      ${headline(`Welcome, ${p.userName}!`, `Your account has been created on the STALKER Cash Control Intelligence platform.`)}
      ${detailTable([
        ['Name', `<strong style="color:${C.textPrimary};">${p.userName}</strong>`],
        ['Email', `<code style="font-family:${C.mono};color:${C.amber};">${p.userEmail}</code>`],
        ['Role', `<strong style="color:${C.blue};">${p.role}</strong>`],
        ['Organisation', `<span style="color:${C.textSecondary};">${p.organizationName}</span>`],
      ])}
      ${infoBox(`<strong>Your Role:</strong> ${roleDesc[p.role] || p.role}`, 'blue')}
      ${ctaButton('Log In to Dashboard', `${this.dashboardUrl}/login`, 'amber')}`;
    return { subject, html: baseLayout(content, `Welcome to STALKER — your ${p.role} account is ready`) };
  }

  // ── Operational: Role Changed ─────────────────────────────────────────────
  roleChanged(p: RoleChangedPayload): { subject: string; html: string } {
    const subject = `Your Role Has Changed: ${p.previousRole} → ${p.newRole}`;
    const content = `
      ${badge('ROLE UPDATED', 'blue', '🔄')}
      ${headline('Your Access Level Has Changed', `Your role in ${p.organizationName} has been updated by an administrator.`)}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="width:48%;background:${C.bgInner};border:1px solid ${C.borderSub};border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:10px;color:${C.textMuted};margin-bottom:6px;font-family:${C.mono};">PREVIOUS ROLE</div>
            <div style="font-weight:700;color:${C.textMuted};font-size:15px;">${p.previousRole}</div>
          </td>
          <td style="width:4%;text-align:center;color:${C.textMuted};font-size:18px;">→</td>
          <td style="width:48%;background:${C.bgInner};border:1px solid ${C.blue}44;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:10px;color:${C.textMuted};margin-bottom:6px;font-family:${C.mono};">NEW ROLE</div>
            <div style="font-weight:700;color:${C.blue};font-size:15px;">${p.newRole}</div>
          </td>
        </tr>
      </table>
      ${detailTable([
        ['User', `<strong style="color:${C.textPrimary};">${p.userName}</strong>`],
        ['Organisation', `<span style="color:${C.textSecondary};">${p.organizationName}</span>`],
        ['Effective', `<span style="color:${C.textSecondary};">${fmtDateTime(new Date())}</span>`],
      ])}
      ${infoBox('Your permissions have been updated. Please log out and back in for changes to take full effect.', 'blue')}
      ${ctaButton('Open Dashboard', `${this.dashboardUrl}/dashboard`, 'blue')}`;
    return { subject, html: baseLayout(content, `Role updated: ${p.userName} is now a ${p.newRole} in ${p.organizationName}`) };
  }
}
