import { Injectable } from '@nestjs/common';
import { subDays, differenceInDays } from 'date-fns';
import { PrismaService } from '../../config/prisma.service';
import { SlaService } from '../sla/sla.service';

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
    const [
      totalOutstandingResult,
      overdueResult,
      overdueCount,
      dueTodayCount,
      totalClients,
      blockedClients,
      chronicClients,
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
    ]);

    const totalOutstanding = Number(totalOutstandingResult._sum.remainingBalance ?? 0);
    const overdueValue = Number(overdueResult._sum.remainingBalance ?? 0);
    const overduePercent = totalOutstanding > 0
      ? Math.round((overdueValue / totalOutstanding) * 100)
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
    };
  }

  private async getActionCentre(organizationId: string) {
    const today = new Date();

    // Top clients to chase: those with OVERDUE or PARTIALLY_PAID invoices
    const clientsWithOverdue = await this.prisma.client.findMany({
      where: {
        organizationId,
        invoices: { some: { status: { in: ['OVERDUE', 'PARTIALLY_PAID'] } } },
      },
      select: {
        id: true, name: true, sector: true,
        paymentDisciplineIndex: true, riskStatus: true, isBlocked: true,
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
        const priorityScore = overdueAmount * (1 + maxDaysOverdue / 30) / (pdi + 1);
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
          priorityScore,
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 5);

    // Top 10 overdue invoices by remaining balance
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

    // Weekly trend — last 4 weeks using PaymentRecord for accuracy (captures partial payments)
    const weeklyTrend: { week: string; collected: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const from = subDays(today, (i + 1) * 7);
      const to = subDays(today, i * 7);
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

    const totalOverdueResult = await this.prisma.invoice.aggregate({
      where: {
        client: { organizationId },
        status: { in: ['OVERDUE', 'PARTIALLY_PAID'] },
      },
      _sum: { remainingBalance: true },
    });
    const totalOverdue = Number(totalOverdueResult._sum.remainingBalance ?? 0);

    const recoveryRate = (collectedThisWeek + totalOverdue) > 0
      ? Math.round((collectedThisWeek / (collectedThisWeek + totalOverdue)) * 100)
      : 0;

    return {
      collectedThisWeek,
      totalOverdue,
      recoveryRate,
      weeklyTrend,
    };
  }

  private async getFollowUpMetrics(organizationId: string) {
    const fiveDaysAgo = subDays(new Date(), 5);
    const [overdueTotal, withRecentFollowUp] = await Promise.all([
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
    ]);
    return {
      overdueTotal,
      withRecentFollowUp,
      staleCount: overdueTotal - withRecentFollowUp,
      complianceRate: overdueTotal > 0
        ? Math.round((withRecentFollowUp / overdueTotal) * 100)
        : 100,
    };
  }
}
