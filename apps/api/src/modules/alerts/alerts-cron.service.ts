import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { differenceInDays, addDays } from 'date-fns';
import { PrismaService } from '../../config/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';

@Injectable()
export class AlertsCronService {
  private readonly logger = new Logger(AlertsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    @InjectQueue('alerts') private alertsQueue: Queue,
    @InjectQueue('emails') private emailsQueue: Queue,
  ) {}

  // ── Run every day at 07:00 AM ──────────────────
  @Cron('0 7 * * *', { name: 'pre-due-alert-engine' })
  async runPreDueAlertEngine() {
    this.logger.log('ENGINE 1 — Pre-Due Alert Engine running...');
    const today = new Date();

    // Sync invoice statuses first
    const { updated } = await this.invoicesService.syncInvoiceStatuses();
    this.logger.log(`Status sync completed: ${updated} invoices updated`);

    // Find invoices due in 7, 3, or 1 days
    const alertThresholds = [
      { days: 7, type: 'DUE_7_DAYS' },
      { days: 3, type: 'DUE_3_DAYS' },
      { days: 1, type: 'DUE_1_DAY' },
    ];

    for (const threshold of alertThresholds) {
      const targetDate = addDays(today, threshold.days);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const invoices = await this.prisma.invoice.findMany({
        where: {
          status: 'PENDING',
          dueDate: { gte: startOfDay, lte: endOfDay },
        },
        include: {
          client: {
            include: {
              organization: { select: { name: true } },
            },
          },
        },
      });

      for (const invoice of invoices) {
        // Skip if alert already sent for this threshold
        const alertsSent = (invoice.alertsSent as string[]) || [];
        if (alertsSent.includes(threshold.type)) continue;

        // Create dashboard alert
        await this.prisma.alert.create({
          data: {
            invoiceId: invoice.id,
            alertType: threshold.type as any,
            channel: 'dashboard',
            message: `Invoice ${invoice.invoiceNumber} for ${invoice.client.name} is due in ${threshold.days} day(s). Amount: ${invoice.invoiceAmount}`,
          },
        });

        // Queue email alert
        await this.emailsQueue.add('send-pre-due-alert', {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.client.name,
          clientEmail: invoice.client.email,
          amount: invoice.invoiceAmount,
          dueDate: invoice.dueDate,
          daysUntilDue: threshold.days,
        }, { delay: 0 });

        // Mark alert as sent
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { alertsSent: [...alertsSent, threshold.type] },
        });

        this.logger.log(`Pre-due alert (${threshold.days}d) sent for invoice ${invoice.invoiceNumber}`);
      }
    }

    // ENGINE 3: Follow-Up Clock — check stale follow-ups
    await this.runFollowUpClockEngine();
  }

  // ── ENGINE 3: Follow-Up Clock ─────────────────
  async runFollowUpClockEngine() {
    this.logger.log('ENGINE 3 — Follow-Up Clock Engine running...');
    const today = new Date();
    const fiveDaysAgo = addDays(today, -5);

    // Find overdue invoices with no follow-up in 5+ days
    const staleInvoices = await this.prisma.invoice.findMany({
      where: {
        status: 'OVERDUE',
        OR: [
          // No follow-ups at all
          { followUps: { none: {} } },
          // Last follow-up was more than 5 days ago
          {
            followUps: {
              every: { followUpDate: { lt: fiveDaysAgo } },
            },
          },
        ],
      },
      include: {
        client: true,
        followUps: { orderBy: { followUpDate: 'desc' }, take: 1 },
      },
    });

    for (const invoice of staleInvoices) {
      const lastFollowUp = invoice.followUps[0];
      const daysSince = lastFollowUp
        ? differenceInDays(today, new Date(lastFollowUp.followUpDate))
        : differenceInDays(today, new Date(invoice.dueDate));

      // Create stale follow-up alert
      await this.prisma.alert.upsert({
        where: {
          // Use composite to avoid duplicates
          id: `stale-${invoice.id}-${today.toISOString().split('T')[0]}`,
        },
        update: {},
        create: {
          id: `stale-${invoice.id}-${today.toISOString().split('T')[0]}`,
          invoiceId: invoice.id,
          alertType: 'FOLLOW_UP_STALE',
          channel: 'dashboard',
          message: `No follow-up for ${daysSince} days on invoice ${invoice.invoiceNumber} (${invoice.client.name}). Amount: ${invoice.invoiceAmount}`,
        },
      });
    }

    this.logger.log(`Follow-up clock: ${staleInvoices.length} stale invoices flagged`);
  }

  // ── Run every Monday at 08:00 AM ──────────────
  @Cron('0 8 * * 1', { name: 'weekly-pdi-sync' })
  async runWeeklyPdiSync() {
    this.logger.log('Weekly PDI recalculation running...');
    const clients = await this.prisma.client.findMany({ select: { id: true } });
    for (const client of clients) {
      await this.alertsQueue.add('recalculate-pdi', { clientId: client.id }, { priority: 10 });
    }
    this.logger.log(`PDI recalculation queued for ${clients.length} clients`);
  }
}
