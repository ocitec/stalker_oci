import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';

/**
 * Hourly sweep that flags long-running PROCESSING payments as MISSING_CONFIRMATION
 * once they exceed the configured timeout (PAYMENT_CONFIRMATION_TIMEOUT_HOURS, default 48h).
 */
@Injectable()
export class PaymentsCronService {
  private readonly logger = new Logger(PaymentsCronService.name);
  private readonly timeoutHours: number;

  constructor(
    private readonly payments: PaymentsService,
    private readonly config:   ConfigService,
  ) {
    this.timeoutHours = Number(this.config.get('PAYMENT_CONFIRMATION_TIMEOUT_HOURS') ?? 48);
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'stale-payment-confirmation' })
  async run() {
    const flagged = await this.payments.flagStaleProcessingPayments(this.timeoutHours);
    if (flagged > 0) {
      this.logger.log(`Stale-payment cron flagged ${flagged} payment(s) beyond ${this.timeoutHours}h`);
    }
  }
}
