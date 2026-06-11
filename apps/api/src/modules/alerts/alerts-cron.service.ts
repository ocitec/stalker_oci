import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { differenceInDays, addDays, subDays } from 'date-fns';
import { PrismaService } from '../../config/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { EmailJobName } from '../email/email.types';

@Injectable()
export class AlertsCronService {
  private readonly logger = new Logger(AlertsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    @InjectQueue('alerts') private alertsQueue: Queue,
    @InjectQueue('emails') private emailsQueue: Queue,
  ) {}

  // ── Daily 07:00 — Pre-due alerts + overdue detection + stale follow-ups ──
  @Cron('0 7 * * *', { name: 'pre-due-alert-engine' })
  async runPreDueAlertEngine() {
    this.logger.log('ENGINE 1 — Pre-Due Alert Engine running...');
    const today = new Date();

    const { updated } = await this.invoicesService.syncInvoiceStatuses();
    this.logger.log(`Status sync: ${updated} invoices updated`);

    const alertThresholds = [
      { days: 7, type: 'DUE_7_DAYS' },
      { days: 3, type: 'DUE_3_DAYS' },
      { days: 1, type: 'DUE_1_DAY' },
    ];

    for (const threshold of alertThresholds) {
      const targetDate = addDays(today, threshold.days);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay   = new Date(targetDate.setHours(23, 59, 59, 999));

      const invoices = await this.prisma.invoice.findMany({
        where: {
          status: 'PENDING',
          dueDate: { gte: startOfDay, lte: endOfDay },
        },
        include: { client: true },
      });

      for (const invoice of invoices) {
        const alertsSent = (invoice.alertsSent as string[]) || [];
        if (alertsSent.includes(threshold.type)) continue;

        await this.prisma.alert.create({
          data: {
            invoiceId: invoice.id,
            alertType: threshold.type as any,
            channel: 'dashboard',
            message: `Invoice ${invoice.invoiceNumber} for ${invoice.client.name} is due in ${threshold.days} day(s). Amount: ${invoice.invoiceAmount}`,
          },
        });

        const jobId = `${EmailJobName.PRE_DUE_ALERT}:${invoice.id}:${threshold.type}`;
        await this.emailsQueue.add(
          EmailJobName.PRE_DUE_ALERT,
          {
            invoiceId:    invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            clientName:   invoice.client.name,
            clientEmail:  invoice.client.email,
            amount:       invoice.invoiceAmount,
            dueDate:      invoice.dueDate,
            daysUntilDue: threshold.days,
          },
          { jobId, delay: 0 },
        );

        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data:  { alertsSent: [...alertsSent, threshold.type] },
        });

        this.logger.log(`Pre-due alert (${threshold.days}d) queued for ${invoice.invoiceNumber}`);
      }
    }

    await this.runFollowUpClockEngine();
  }

  // ── Follow-up clock (called from daily cron) ───────────────────────────────
  async runFollowUpClockEngine() {
    this.logger.log('ENGINE 3 — Follow-Up Clock Engine running...');
    const today      = new Date();
    const fiveDaysAgo = addDays(today, -5);

    const staleInvoices = await this.prisma.invoice.findMany({
      where: {
        status: 'OVERDUE',
        OR: [
          { followUps: { none: {} } },
          { followUps: { every: { followUpDate: { lt: fiveDaysAgo } } } },
        ],
      },
      include: {
        client:   true,
        followUps: { orderBy: { followUpDate: 'desc' }, take: 1 },
      },
    });

    const dateKey = today.toISOString().split('T')[0];

    for (const invoice of staleInvoices) {
      const lastFollowUp = invoice.followUps[0];
      const daysSince    = lastFollowUp
        ? differenceInDays(today, new Date(lastFollowUp.followUpDate))
        : differenceInDays(today, new Date(invoice.dueDate));

      await this.prisma.alert.upsert({
        where:  { id: `stale-${invoice.id}-${dateKey}` },
        update: {},
        create: {
          id:        `stale-${invoice.id}-${dateKey}`,
          invoiceId: invoice.id,
          alertType: 'FOLLOW_UP_STALE',
          channel:   'dashboard',
          message:   `No follow-up for ${daysSince} days on invoice ${invoice.invoiceNumber} (${invoice.client.name}). Amount: ${invoice.invoiceAmount}`,
        },
      });

      // Queue email to all active finance/admin users in the org
      const orgUsers = await this.prisma.user.findMany({
        where: {
          organizationId: invoice.client.organizationId,
          isActive: true,
          role: { in: ['CFO', 'ADMIN', 'FINANCE'] },
        },
        select: { email: true },
      });

      for (const user of orgUsers) {
        if (!user.email) continue;
        const jobId = `${EmailJobName.STALE_FOLLOWUP}:${invoice.id}:${dateKey}:${user.email}`;
        await this.emailsQueue.add(
          EmailJobName.STALE_FOLLOWUP,
          {
            invoiceId:        invoice.id,
            invoiceNumber:    invoice.invoiceNumber,
            clientName:       invoice.client.name,
            assigneeEmail:    user.email,
            daysSinceFollowUp: daysSince,
            amount:           invoice.invoiceAmount,
          },
          { jobId },
        );
      }
    }

    this.logger.log(`Follow-up clock: ${staleInvoices.length} stale invoices processed`);
  }

  // ── Monday 08:00 — PDI sync + weekly CFO report ───────────────────────────
  @Cron('0 8 * * 1', { name: 'weekly-pdi-sync' })
  async runWeeklyPdiSync() {
    this.logger.log('Weekly PDI recalculation + CFO report running...');

    const clients = await this.prisma.client.findMany({ select: { id: true } });
    for (const client of clients) {
      await this.alertsQueue.add('recalculate-pdi', { clientId: client.id }, { priority: 10 });
    }
    this.logger.log(`PDI recalculation queued for ${clients.length} clients`);

    await this.queueWeeklyCfoReports();
  }

  // ── Build + queue weekly CFO report for every organisation ────────────────
  private async queueWeeklyCfoReports() {
    const orgs = await this.prisma.organization.findMany({
      select: { id: true, name: true },
    });

    const weekAgo = subDays(new Date(), 7);

    for (const org of orgs) {
      try {
        const [collected, newOverdueCount, followUpsLogged, newViolations, chronicClients, topOverdue, riskChanges] =
          await Promise.all([
            this.prisma.invoice.aggregate({
              where: { client: { organizationId: org.id }, status: 'PAID', paidDate: { gte: weekAgo } },
              _sum: { invoiceAmount: true },
            }),
            this.prisma.invoice.count({
              where: { client: { organizationId: org.id }, status: 'OVERDUE', updatedAt: { gte: weekAgo } },
            }),
            this.prisma.followUp.count({
              where: { invoice: { client: { organizationId: org.id } }, followUpDate: { gte: weekAgo } },
            }),
            this.prisma.slaViolation.count({
              where: { client: { organizationId: org.id }, violationDate: { gte: weekAgo } },
            }),
            this.prisma.client.findMany({
              where: { organizationId: org.id, riskStatus: 'CHRONIC' },
              select: { name: true, paymentDisciplineIndex: true },
            }),
            this.prisma.invoice.findMany({
              where: { client: { organizationId: org.id }, status: { in: ['OVERDUE', 'PARTIALLY_PAID'] } },
              include: { client: { select: { name: true } } },
              orderBy: { remainingBalance: 'desc' },
              take: 5,
            }),
            this.prisma.client.findMany({
              where: { organizationId: org.id, updatedAt: { gte: weekAgo } },
              select: { name: true, riskStatus: true },
            }),
          ]);

        const totalOutstanding = await this.prisma.invoice.aggregate({
          where: { client: { organizationId: org.id }, status: { in: ['OVERDUE', 'PARTIALLY_PAID', 'PENDING', 'DUE_TODAY'] } },
          _sum: { remainingBalance: true },
        });

        const dso = await this.invoicesService.calculateDSO(org.id);

        const week = this.isoWeek(new Date());
        const jobId = `${EmailJobName.WEEKLY_CFO_REPORT}:${org.id}:${week}`;

        await this.emailsQueue.add(
          EmailJobName.WEEKLY_CFO_REPORT,
          {
            organizationId:   org.id,
            organizationName: org.name,
            period: { from: weekAgo.toISOString(), to: new Date().toISOString() },
            kpis: {
              collectedThisWeek: Number(collected._sum.invoiceAmount ?? 0),
              newOverdueInvoices: newOverdueCount,
              followUpsLogged,
              totalOutstanding: Number(totalOutstanding._sum.remainingBalance ?? 0),
              currentDso: dso,
            },
            newSlaViolations: newViolations,
            chronicClients: chronicClients.map(c => ({
              name: c.name,
              pdi:  Number(c.paymentDisciplineIndex),
            })),
            topOverdueClients: topOverdue.map(inv => ({
              name:   inv.client.name,
              amount: Number(inv.remainingBalance ?? inv.invoiceAmount),
            })),
            riskChanges: riskChanges.map(c => ({
              name: c.name, from: 'UNKNOWN', to: c.riskStatus,
            })),
          },
          { jobId },
        );

        this.logger.log(`Weekly CFO report queued for ${org.name}`);
      } catch (err) {
        this.logger.error(`Failed to queue CFO report for org ${org.id}: ${(err as Error).message}`);
      }
    }
  }

  private isoWeek(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }
}
