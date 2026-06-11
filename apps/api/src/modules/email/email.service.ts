import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as postmark from 'postmark';
import { Resend } from 'resend';
import { PrismaService } from '../../config/prisma.service';
import { EmailSendOptions, EmailSendResult } from './email.types';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);

  private postmarkClient: postmark.ServerClient | null = null;
  private resendClient: Resend | null = null;
  private fromAddress: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const postmarkKey = this.config.get<string>('email.postmarkApiKey');
    const resendKey   = this.config.get<string>('email.resendApiKey');
    this.fromAddress  = this.config.get<string>('email.from') || 'STALKER Cash Control <noreply@stalker-cashcontrol.com>';

    if (postmarkKey) {
      this.postmarkClient = new postmark.ServerClient(postmarkKey);
      this.logger.log('Postmark client initialised');
    } else {
      this.logger.warn('POSTMARK_API_KEY not set — primary email provider disabled');
    }

    if (resendKey) {
      this.resendClient = new Resend(resendKey);
      this.logger.log('Resend client initialised');
    } else {
      this.logger.warn('RESEND_API_KEY not set — fallback email provider disabled');
    }
  }

  // ── Main send method ───────────────────────────────────────────────────────
  async send(opts: EmailSendOptions): Promise<EmailSendResult> {
    // Idempotency check — skip if already successfully delivered
    if (opts.idempotencyKey) {
      const existing = await this.prisma.emailLog.findUnique({
        where: { idempotencyKey: opts.idempotencyKey },
      });
      if (existing && (existing.status === 'SENT' || existing.status === 'FALLBACK_SENT')) {
        this.logger.debug(`Skipping duplicate email [${opts.idempotencyKey}]`);
        return {
          provider: existing.provider as 'POSTMARK' | 'RESEND',
          messageId: existing.providerMessageId,
          usedFallback: existing.usedFallback,
          skipped: true,
        };
      }
    }

    // Try Postmark first
    if (this.postmarkClient) {
      try {
        const msgId = await this.sendViaPostmark(opts);
        await this.log({ opts, provider: 'POSTMARK', status: 'SENT', messageId: msgId, usedFallback: false });
        this.logger.log(`[POSTMARK] Sent "${opts.subject}" → ${opts.to} (job: ${opts.jobName})`);
        return { provider: 'POSTMARK', messageId: msgId, usedFallback: false, skipped: false };
      } catch (postmarkErr) {
        this.logger.warn(`[POSTMARK] Failed: ${(postmarkErr as Error).message} — falling back to Resend`);
        await this.log({
          opts, provider: 'POSTMARK', status: 'FAILED',
          errorMessage: (postmarkErr as Error).message, usedFallback: false,
        });
      }
    }

    // Fallback to Resend
    if (this.resendClient) {
      try {
        const msgId = await this.sendViaResend(opts);
        await this.log({ opts, provider: 'RESEND', status: 'FALLBACK_SENT', messageId: msgId, usedFallback: true });
        this.logger.log(`[RESEND FALLBACK] Sent "${opts.subject}" → ${opts.to} (job: ${opts.jobName})`);
        return { provider: 'RESEND', messageId: msgId, usedFallback: true, skipped: false };
      } catch (resendErr) {
        const msg = (resendErr as Error).message;
        await this.log({ opts, provider: 'RESEND', status: 'FALLBACK_FAILED', errorMessage: msg, usedFallback: true });
        this.logger.error(`[RESEND FALLBACK] Also failed: ${msg} (job: ${opts.jobName}, to: ${opts.to})`);
        throw new Error(`Email delivery failed via all providers — last error: ${msg}`);
      }
    }

    // Neither provider configured — log and throw so BullMQ can retry later
    await this.log({ opts, provider: 'POSTMARK', status: 'FAILED', errorMessage: 'No email provider configured', usedFallback: false });
    throw new Error('No email provider is configured. Set POSTMARK_API_KEY or RESEND_API_KEY.');
  }

  // ── Postmark ───────────────────────────────────────────────────────────────
  private async sendViaPostmark(opts: EmailSendOptions): Promise<string> {
    const response = await this.postmarkClient!.sendEmail({
      From:     this.fromAddress,
      To:       opts.to,
      Subject:  opts.subject,
      HtmlBody: opts.html,
      MessageStream: 'outbound',
    });

    if (response.ErrorCode && response.ErrorCode !== 0) {
      throw new Error(`Postmark error ${response.ErrorCode}: ${response.Message}`);
    }

    return response.MessageID;
  }

  // ── Resend ─────────────────────────────────────────────────────────────────
  private async sendViaResend(opts: EmailSendOptions): Promise<string> {
    const { data, error } = await this.resendClient!.emails.send({
      from:    this.fromAddress,
      to:      opts.to,
      subject: opts.subject,
      html:    opts.html,
    });

    if (error) throw new Error(`Resend error: ${error.message}`);
    return data?.id ?? '';
  }

  // ── Database logging ───────────────────────────────────────────────────────
  private async log(args: {
    opts: EmailSendOptions;
    provider: 'POSTMARK' | 'RESEND';
    status: 'SENT' | 'FAILED' | 'FALLBACK_SENT' | 'FALLBACK_FAILED';
    messageId?: string;
    errorMessage?: string;
    usedFallback: boolean;
  }) {
    try {
      await this.prisma.emailLog.create({
        data: {
          jobName:          args.opts.jobName,
          recipient:        args.opts.to,
          subject:          args.opts.subject,
          provider:         args.provider,
          status:           args.status,
          providerMessageId: args.messageId ?? null,
          errorMessage:     args.errorMessage ?? null,
          idempotencyKey:   args.opts.idempotencyKey ?? null,
          usedFallback:     args.usedFallback,
          metadata:         args.opts.metadata ? (args.opts.metadata as any) : undefined,
        },
      });
    } catch (err) {
      // Logging failure must never crash the email send path
      this.logger.error(`Failed to write EmailLog: ${(err as Error).message}`);
    }
  }
}
