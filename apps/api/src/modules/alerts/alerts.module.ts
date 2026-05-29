import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { AlertsCronService } from './alerts-cron.service';
import { AlertsProcessor } from './alerts.processor';
import { EmailsProcessor } from './emails.processor';
import { InvoicesModule } from '../invoices/invoices.module';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [
    InvoicesModule,
    ClientsModule,
    BullModule.registerQueue({ name: 'alerts' }),
    BullModule.registerQueue({
      name: 'emails',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsCronService, AlertsProcessor, EmailsProcessor],
  exports: [AlertsService],
})
export class AlertsModule {}
