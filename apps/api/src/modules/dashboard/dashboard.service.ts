import { Injectable } from '@nestjs/common';
import { subDays, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { PrismaService } from '../../config/prisma.service';
import { SlaService } from '../sla/sla.service';
import { computeRecommendedAction } from '../../common/utils/action-recommendation.util';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slaService: SlaService,
  ) {}

  async getExecutiveDashboard(organizationId: string) {
    const [
      kpis,
      actionCentre,
      creditEnforcement,
      slaSummary,
      followUpCompliance,
      collectionsPerformance,
    ] = await Promise.all([
      this.getCoreKPIs(organizationId),
      this.getActionCentre(organizationId),
      this.getCreditEnforcement(organizationId),
      this.slaService.getSummary(organizationId),
      this.getFollowUpMetrics(organizationId),
      this.getCollectionsPerformance(organizationId),
    ]);

    return {
      kpis,
      actionCentre,
      creditEnforcement,
      slaSummary,
      followUpCompliance,
      collectionsPerformance,
    };
  }

  private async getCoreKPIs(organizationId: string) {
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);

    const [
      totalOutstandingResult,
      overdueResult,
      overdueCount,
      dueTodayCount,
      totalClients,
      blockedClients,
      chronicClients,
      paymentsLast30,
      newOverdueLast30,
      newInvoicesLast30,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: {
          client: { organizationId },
          status: { in: ['PENDING', 'DUE_TODAY', 'OVERDUE', 'PARTIALLY_PAID'] },
        },
        _sum: { remainingBalance: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          client: { organizationId },
          status: { in: ['OVERDUE', 'PARTIALLY_PAID'] },
        },
        _sum: { remainingBalance: true },
      }),
      this.prisma.invoice.count({
        where: { client: { organizationId }, status: { in: ['OVERDUE', 'PARTIALLY_PAID'] } },
      }),
      this.prisma.invoice.count({
        where: { client: { organizationId }, status: 'DUE_TODAY' },
      }),
      this.prisma.client.count({ where: { organizationId } }),
      this.prisma.client.count({ where: { organizationId, isBlocked: true } }),
      this.prisma.client.count({ where: { organizationId, riskStatus: 'CHRONIC' } }),
      // Trend: payments received in last 30 days
      this.prisma.paymentRecord.aggregate({
        where: {
          invoice: { client: { organizationId } },
          isReverted: false,
          paymentDate: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
      }),
      // Trend: overdue invoices whose due date fell in the last 30 days (new additions)
      this.prisma.invoice.aggregate({
        where: {
          client: { organizationId },
          status: { in: ['OVERDUE', 'PARTIALLY_PAID'] },
          dueDate: { gte: thirtyDaysAgo, lt: today },
        },
        _sum: { remainingBalance: true },
      }),
      // Trend: new invoices issued in last 30 days (added to outstanding pool)
      this.prisma.invoice.aggregate({
        where: {
          client: { organizationId },
          invoiceDate: { gte: thirtyDaysAgo },
        },
        _sum: { invoiceAmount: true },
      }),
    ]);

    const totalOutstanding = Number(totalOutstandingResult._sum.remainingBalance ?? 0);
    const overdueValue     = Number(overdueResult._sum.remainingBalance ?? 0);
    const overduePercent   = totalOutstanding > 0
      ? Math.round((overdueValue / totalOutstanding) * 100)
      : 0;

    // Month-over-month approximation:
    //   lastMonthValue ≈ currentValue - newAdditionsThisMonth + collectionsThisMonth
    const collected30d  = Number(paymentsLast30._sum.amount             ?? 0);
    const newOverdueAmt = Number(newOverdueLast30._sum.remainingBalance  ?? 0);
    const newInvoiceAmt = Number(newInvoicesLast30._sum.invoiceAmount    ?? 0);

    const overdueLastMonth     = Math.max(0, overdueValue     - newOverdueAmt + collected30d);
    const outstandingLastMonth = Math.max(0, totalOutstanding - newInvoiceAmt + collected30d);

    const overdueChangePct = overdueLastMonth > 0
      ? Math.round(((overdueValue - overdueLastMonth) / overdueLastMonth) * 100)
      : 0;
    const outstandingChangePct = outstandingLastMonth > 0
      ? Math.round(((totalOutstanding - outstandingLastMonth) / outstandingLastMonth) * 100)
      : 0;

    return {
      totalOutstanding,
      overdueValue,
      overduePercent,
      overdueCount,
      dueTodayCount,
      totalClients,
      blockedClients,
      chronicClients,
      overdueChangePct,
      outstandingChangePct,
    };
  }

  private async getActionCentre(organizationId: string) {
    const today = new Date();

    const clientsWithOverdue = await this.prisma.client.findMany({
      where: {
        organizationId,
        invoices: { some: { status: { in: ['OVERDUE', 'PARTIALLY_PAID'] } } },
      },
      select: {
        id: true, name: true, sector: true,
        paymentDisciplineIndex: true, riskStatus: true, isBlocked: true,
        creditLimit: true,
        slaViolations: {
          where: { resolved: false },
          select: { id: true },
        },
        invoices: {
          where: { status: { in: ['OVERDUE', 'PARTIALLY_PAID'] } },
          select: {
            remainingBalance: true, invoiceAmount: true, dueDate: true,
            followUps: {
              orderBy: { followUpDate: 'desc' },
              take: 1,
              select: { followUpDate: true },
            },
          },
        },
      },
    });

    const clientsToChase = clientsWithOverdue
      .map(c => {
        const overdueAmount = c.invoices.reduce(
          (s, i) => s + Number(i.remainingBalance ?? i.invoiceAmount), 0,
        );
        const maxDaysOverdue = c.invoices.reduce((max, inv) => {
          const days = Math.max(0, differenceInDays(today, new Date(inv.dueDate)));
          return days > max ? days : max;
        }, 0);
        const lastFollowUp = c.invoices
          .flatMap(i => i.followUps)
          .sort((a, b) => new Date(b.followUpDate).getTime() - new Date(a.followUpDate).getTime())[0];
        const daysSinceFollowUp = lastFollowUp
          ? differenceInDays(today, new Date(lastFollowUp.followUpDate))
          : null;
        const pdi = Number(c.paymentDisciplineIndex);
        const creditLimit = Number(c.creditLimit ?? 0);
        const utilizationPercent = creditLimit > 0
          ? Math.round((overdueAmount / creditLimit) * 100)
          : 0;
        const slaBreachCount = c.slaViolations.length;
        const priorityScore = overdueAmount * (1 + maxDaysOverdue / 30) / (pdi + 1);

        const recommendedAction = computeRecommendedAction({
          maxDaysOverdue,
          pdi,
          riskStatus: c.riskStatus,
          outstandingAmount: overdueAmount,
          utilizationPercent,
          slaBreachCount,
        });

        return {
          id: c.id,
          name: c.name,
          sector: c.sector,
          paymentDisciplineIndex: pdi,
          riskStatus: c.riskStatus,
          isBlocked: c.isBlocked,
          overdueAmount,
          overdueInvoiceCount: c.invoices.length,
          maxDaysOverdue,
          daysSinceFollowUp,
          slaBreachCount,
          utilizationPercent,
          priorityScore,
          recommendedAction,
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 5);

    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        client: { organizationId },
        status: { in: ['OVERDUE', 'PARTIALLY_PAID'] },
      },
      include: {
        client: { select: { id: true, name: true } },
        followUps: { orderBy: { followUpDate: 'desc' }, take: 1, select: { followUpDate: true } },
      },
      orderBy: { remainingBalance: 'desc' },
      take: 10,
    });

    const topOverdueInvoices = overdueInvoices.map(inv => {
      const daysOverdue = Math.max(0, differenceInDays(today, new Date(inv.dueDate)));
      const lastFollowUp = inv.followUps[0];
      const daysSinceFollowUp = lastFollowUp
        ? differenceInDays(today, new Date(lastFollowUp.followUpDate))
        : null;
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientId: inv.client.id,
        clientName: inv.client.name,
        remainingBalance: Number(inv.remainingBalance ?? inv.invoiceAmount),
        dueDate: inv.dueDate,
        daysOverdue,
        daysSinceFollowUp,
        status: inv.status,
      };
    });

    return { clientsToChase, topOverdueInvoices };
  }

  private async getCreditEnforcement(organizationId: string) {
    const clients = await this.prisma.client.findMany({
      where: { organizationId, creditLimit: { gt: 0 } },
      select: {
        id: true, name: true, sector: true,
        paymentDisciplineIndex: true, riskStatus: true,
        creditLimit: true, isBlocked: true,
        invoices: {
          where: { status: { in: ['PENDING', 'DUE_TODAY', 'OVERDUE', 'PARTIALLY_PAID'] } },
          select: { remainingBalance: true, invoiceAmount: true },
        },
      },
    });

    const enriched = clients.map(c => {
      const outstanding = c.invoices.reduce(
        (s, i) => s + Number(i.remainingBalance ?? i.invoiceAmount), 0,
      );
      const creditLimit = Number(c.creditLimit);
      const utilizationPercent = creditLimit > 0
        ? Math.round((outstanding / creditLimit) * 100)
        : 0;
      return {
        id: c.id,
        name: c.name,
        sector: c.sector,
        paymentDisciplineIndex: Number(c.paymentDisciplineIndex),
        riskStatus: c.riskStatus,
        creditLimit,
        outstandingAmount: outstanding,
        utilizationPercent,
        isBlocked: c.isBlocked,
      };
    });

    const breaches = enriched
      .filter(c => c.utilizationPercent > 100)
      .sort((a, b) => b.utilizationPercent - a.utilizationPercent)
      .slice(0, 5);

    const nearLimit = enriched
      .filter(c => c.utilizationPercent >= 80 && c.utilizationPercent <= 100)
      .sort((a, b) => b.utilizationPercent - a.utilizationPercent)
      .slice(0, 5);

    const recommendCreditHold = enriched
      .filter(c =>
        !c.isBlocked &&
        (c.riskStatus === 'CHRONIC' || c.riskStatus === 'HIGH_RISK') &&
        c.outstandingAmount > 0,
      )
      .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
      .slice(0, 5);

    return {
      breaches,
      nearLimit,
      recommendCreditHold,
      totalBreaches: enriched.filter(c => c.utilizationPercent > 100).length,
      totalNearLimit: enriched.filter(c => c.utilizationPercent >= 80 && c.utilizationPercent <= 100).length,
    };
  }

  private async getCollectionsPerformance(organizationId: string) {
    const today = new Date();

    const weeklyTrend: { week: string; collected: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const from = subDays(today, (i + 1) * 7);
      const to   = subDays(today, i * 7);
      const label = i === 0 ? 'This wk' : `${i}w ago`;

      const result = await this.prisma.paymentRecord.aggregate({
        where: {
          invoice: { client: { organizationId } },
          isReverted: false,
          paymentDate: { gte: from, lt: to },
        },
        _sum: { amount: true },
      });
      weeklyTrend.push({ week: label, collected: Number(result._sum.amount ?? 0) });
    }

    const collectedThisWeek = weeklyTrend[weeklyTrend.length - 1].collected;

    // 30-day total for a meaningful monthly picture
    const monthlyResult = await this.prisma.paymentRecord.aggregate({
      where: {
        invoice: { client: { organizationId } },
        isReverted: false,
        paymentDate: { gte: subDays(today, 30) },
      },
      _sum: { amount: true },
    });
    const collectedThisMonth = Number(monthlyResult._sum.amount ?? 0);

    const totalOverdueResult = await this.prisma.invoice.aggregate({
      where: {
        client: { organizationId },
        status: { in: ['OVERDUE', 'PARTIALLY_PAID'] },
      },
      _sum: { remainingBalance: true },
    });
    const totalOverdue = Number(totalOverdueResult._sum.remainingBalance ?? 0);

    // Weekly target = 10 % of overdue portfolio (aspirational but grounded in the actual debt)
    const weeklyTarget       = Math.round(totalOverdue * 0.10);
    const monthlyTarget      = Math.round(totalOverdue * 0.40);
    // Target achievement this week (capped at 150 % to handle over-performance)
    const targetAchievement  = weeklyTarget > 0
      ? Math.min(150, Math.round((collectedThisWeek / weeklyTarget) * 100))
      : 0;
    const recoveryGap         = Math.max(0, weeklyTarget - collectedThisWeek);
    const expectedRecoverable = Math.round(totalOverdue * 0.75);
    // Portfolio recovery rate: 30-day collections vs what remains outstanding
    const portfolioRecoveryRate = (collectedThisMonth + totalOverdue) > 0
      ? Math.round((collectedThisMonth / (collectedThisMonth + totalOverdue)) * 100)
      : 0;

    return {
      collectedThisWeek,
      collectedThisMonth,
      totalOverdue,
      weeklyTarget,
      monthlyTarget,
      targetAchievement,
      recoveryGap,
      expectedRecoverable,
      portfolioRecoveryRate,
      weeklyTrend,
    };
  }

  private async getFollowUpMetrics(organizationId: string) {
    const today = new Date();
    const fiveDaysAgo = subDays(today, 5);
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const [overdueTotal, withRecentFollowUp, completedToday, escalationsPending, followUpsDueToday] =
      await Promise.all([
        this.prisma.invoice.count({
          where: { client: { organizationId }, status: { in: ['OVERDUE', 'PARTIALLY_PAID'] } },
        }),
        this.prisma.invoice.count({
          where: {
            client: { organizationId },
            status: { in: ['OVERDUE', 'PARTIALLY_PAID'] },
            followUps: { some: { followUpDate: { gte: fiveDaysAgo } } },
          },
        }),
        this.prisma.followUp.count({
          where: {
            invoice: { client: { organizationId } },
            followUpDate: { gte: todayStart, lte: todayEnd },
          },
        }),
        this.prisma.alert.count({
          where: {
            invoice: { client: { organizationId } },
            alertType: { in: ['PDI_THRESHOLD', 'CREDIT_LIMIT_BREACH'] },
            isRead: false,
          },
        }),
        this.prisma.followUp.count({
          where: {
            invoice: {
              client: { organizationId },
              status: { in: ['OVERDUE', 'PARTIALLY_PAID'] },
            },
            nextFollowUpDate: { gte: todayStart, lte: todayEnd },
          },
        }),
      ]);

    const staleCount = overdueTotal - withRecentFollowUp;

    return {
      overdueTotal,
      withRecentFollowUp,
      staleCount,
      complianceRate: overdueTotal > 0
        ? Math.round((withRecentFollowUp / overdueTotal) * 100)
        : 100,
      followUpsDueToday,
      overdueFollowUps: staleCount,
      completedToday,
      escalationsPending,
    };
  }
}
