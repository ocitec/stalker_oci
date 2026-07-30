import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EmailJobName, InternalNoticePayload } from '../../modules/email/email.types';

/**
 * Thin wrapper over the shared 'emails' BullMQ queue for the financial-control
 * modules. Enqueues a generic INTERNAL_NOTICE the emails processor renders and
 * fans out to finance/CFO recipients — the same delivery path every other module
 * uses. Best-effort: a queue failure never breaks the business action.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(@InjectQueue('emails') private readonly emailsQueue: Queue) {}

  async notify(payload: InternalNoticePayload): Promise<void> {
    try {
      await this.emailsQueue.add(
        EmailJobName.INTERNAL_NOTICE,
        payload,
        payload.idempotencyKey ? { jobId: `${EmailJobName.INTERNAL_NOTICE}:${payload.idempotencyKey}` } : {},
      );
    } catch (err) {
      this.logger.warn(`notify(${payload.event}) failed to enqueue — ${String(err)}`);
    }
  }
}
