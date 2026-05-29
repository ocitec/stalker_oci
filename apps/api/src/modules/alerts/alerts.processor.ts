import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../config/prisma.service';
import { ClientsService } from '../clients/clients.service';

@Processor('alerts')
export class AlertsProcessor {
  private readonly logger = new Logger(AlertsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
  ) {}

  @Process('schedule-alerts')
  async scheduleAlerts(job: Job<{ invoiceId: string; dueDate: string; clientId: string }>) {
    const { invoiceId, dueDate, clientId } = job.data;
    const due = new Date(dueDate);
    const now = new Date();

    const thresholds = [
      { days: 7, type: 'DUE_7_DAYS' },
      { days: 3, type: 'DUE_3_DAYS' },
      { days: 1, type: 'DUE_1_DAY' },
    ];

    for (const t of thresholds) {
      const alertTime = new Date(due);
      alertTime.setDate(alertTime.getDate() - t.days);
      const delay = alertTime.getTime() - now.getTime();
      if (delay > 0) {
        // Will be picked up by the cron, this just logs intent
        this.logger.log(`Alert ${t.type} scheduled for invoice ${invoiceId} at ${alertTime.toISOString()}`);
      }
    }
  }

  @Process('recalculate-pdi')
  async recalculatePdi(job: Job<{ clientId: string }>) {
    await this.clientsService.recalculatePDI(job.data.clientId);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.name} #${job.id} failed: ${error.message}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.debug(`Job ${job.name} #${job.id} completed`);
  }
}
