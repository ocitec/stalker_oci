import { Injectable } from '@nestjs/common';
import { subDays, subMonths, format } from 'date-fns';
import { PrismaService } from '../../config/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { SlaService } from '../sla/sla.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly slaService: SlaService,
  ) {}

  async getExecutiveDashboard(organizationId: string) {
    const [
      kpis, agingBuckets, pdiDistribution,
      paymentTrend, topDefaulters, slaSummary,
      recentAlerts, followUpCompliance,
    ] = await Promise.all([
      this.getCoreKPIs(organizationId),
      this.invoicesService.getAgingReport(organizationId),
      this.getPdiDistribution(organizationId),
      this.getPaymentTrend(organizationId),
      this.getTopDefaulters(organizationId),
      this.slaService.getSummary(organizationId),
      this.getRecentAlerts(organizationId),
      this.getFollowUpMetrics(organizationId),
    ]);

    return {
      kpis,
      agingBuckets,
      pdiDistribution,
      paymentTrend,
      topDefaulters,
      slaSummary,
      recentAlerts,
      followUpCompliance,
    };
  }

  private async getCoreKPIs(organizationId: string) {
    const [
      totalOutstanding, overdueValue, overdueCount,
      dso, totalClients, blockedClients,
      chronicClients, dueTodayCount,
    ] = await Promise.all([
      // Total outstanding
      this.prisma.invoice.aggregate({
        where: { client: { organizationId }, status: { in: ['PENDING', 'DUE_TODAY', 'OVERDUE'] } },
        _sum: { invoiceAmount: true },
      }),
      // Overdue value
      this.prisma.invoice.aggregate({
        where: { client: { organizationId }, status: 'OVERDUE' },
        _sum: { invoiceAmount: true },
      }),
      // Overdue count
      this.prisma.invoice.count({
        where: { client: { organizationId }, status: 'OVERDUE' },
      }),
      // DSO
      this.invoicesService.calculateDSO(organizationId),
      // Total clients
      this.prisma.client.count({ where: { organizationId } }),
      // Blocked clients
      this.prisma.client.count({ where: { organizationId, isBlocked: true } }),
      // Chronic clients
      this.prisma.client.count({ where: { organizationId, riskStatus: 'CHRONIC' } }),
      // Due today
      this.prisma.invoice.count({
        where: { client: { organizationId }, status: 'DUE_TODAY' },
      }),
    ]);

    return {
      totalOutstanding: Number(totalOutstanding._sum.invoiceAmount ?? 0),
      overdueValue: Number(overdueValue._sum.invoiceAmount ?? 0),
      overdueCount,
      dso,
      totalClients,
      blockedClients,
      chronicClients,
      dueTodayCount,
    };
  }

  private async getPdiDistribution(organizationId: string) {
    const [reliable, moderate, highRisk, chronic] = await Promise.all([
      this.prisma.client.count({ where: { organizationId, riskStatus: 'RELIABLE' } }),
      this.prisma.client.count({ where: { organizationId, riskStatus: 'MODERATE' } }),
      this.prisma.client.count({ where: { organizationId, riskStatus: 'HIGH_RISK' } }),
      this.prisma.client.count({ where: { organizationId, riskStatus: 'CHRONIC' } }),
    ]);
    return { reliable, moderate, highRisk, chronic };
  }

  private async getPaymentTrend(organizationId: string) {
    const months = 6;
    const trend = [];

    for (let i = months - 1; i >= 0; i--) {
      const from = subMonths(new Date(), i + 1);
      const to = subMonths(new Date(), i);
      const label = format(to, 'MMM');

      const [paid, overdue] = await Promise.all([
        this.prisma.invoice.aggregate({
          where: {
            client: { organizationId },
            status: 'PAID',
            paidDate: { gte: from, lt: to },
          },
          _sum: { invoiceAmount: true },
        }),
        this.prisma.invoice.count({
          where: {
            client: { organizationId },
            status: 'OVERDUE',
            dueDate: { gte: from, lt: to },
          },
        }),
      ]);

      trend.push({
        month: label,
        paidValue: Number(paid._sum.invoiceAmount ?? 0),
        overdueCount: overdue,
      });
    }
    return trend;
  }

  private async getTopDefaulters(organizationId: string, limit = 5) {
    return this.prisma.client.findMany({
      where: {
        organizationId,
        riskStatus: { in: ['CHRONIC', 'HIGH_RISK'] },
      },
      orderBy: { paymentDisciplineIndex: 'asc' },
      take: limit,
      select: {
        id: true, name: true, sector: true,
        paymentDisciplineIndex: true, riskStatus: true,
        creditLimit: true, isBlocked: true,
        invoices: {
          where: { status: { in: ['OVERDUE', 'DUE_TODAY', 'PENDING'] } },
          select: { invoiceAmount: true },
        },
        _count: { select: { slaViolations: true } },
      },
    }).then(clients => clients.map(c => ({
      ...c,
      outstandingAmount: c.invoices.reduce((s, i) => s + Number(i.invoiceAmount), 0),
    })));
  }

  private async getRecentAlerts(organizationId: string) {
    return this.prisma.alert.findMany({
      where: {
        isRead: false,
        invoice: { client: { organizationId } },
      },
      orderBy: { sentAt: 'desc' },
      take: 10,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            client: { select: { name: true } },
          },
        },
      },
    });
  }

  private async getFollowUpMetrics(organizationId: string) {
    const fiveDaysAgo = subDays(new Date(), 5);
    const [overdueTotal, withRecentFollowUp] = await Promise.all([
      this.prisma.invoice.count({
        where: { client: { organizationId }, status: 'OVERDUE' },
      }),
      this.prisma.invoice.count({
        where: {
          client: { organizationId },
          status: 'OVERDUE',
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
