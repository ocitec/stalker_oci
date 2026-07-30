import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsCronService } from './payments-cron.service';

@Module({
  controllers: [PaymentsController],
  providers:   [PaymentsService, PaymentsCronService],
  exports:     [PaymentsService],
})
export class PaymentsModule {}
