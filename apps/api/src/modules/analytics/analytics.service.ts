import { Injectable } from '@nestjs/common';
import { subDays, subMonths, differenceInDays, format } from 'date-fns';
import { PrismaService } from '../../config/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  // ── PDI Full Ranking ──────────────────────────
  async getPdiRanking(organizationId: string) {
    const clients = await this.prisma.client.findMany({
      where: { organizationId },
      orderBy: { paymentDisciplineIndex: 'desc' },
      select: {
        id: true, name: true, sector: true,
        paymentDisciplineIndex: true, riskStatus: true,
        isBlocked: true, creditLimit: true,
        _count: { select: { invoices: true, slaViolations: true } },
        invoices: {
          where: { status: { in: ['OVERDUE', 'DUE_TODAY', 'PENDING'] } },
          select: { invoiceAmount: true },
        },
      },
    });

    return clients.map(c => ({
      ...c,
      outstandingAmount: c.invoices.reduce((s, i) => s + Number(i.invoiceAmount), 0),
      invoices: undefined,
    }));
  }

  // ── Sector Analysis ───────────────────────────
  async getSectorAnalysis(organizationId: string) {
    const clients = await this.prisma.client.findMany({
      where: { organizationId, sector: { not: null } },
      select: {
        sector: true,
        paymentDisciplineIndex: true,
        riskStatus: true,
        invoices: {
          where: { status: 'PAID' },
          select: { invoiceDate: true, paidDate: true, dueDate: true },
        },
      },
    });

    const sectorMap: Record<string, { pdis: number[]; delays: number[]; count: number }> = {};

    for (const client of clients) {
      const sector = client.sector!;
      if (!sectorMap[sector]) sectorMap[sector] = { pdis: [], delays: [], count: 0 };
      sectorMap[sector].pdis.push(Number(client.paymentDisciplineIndex));
      sectorMap[sector].count++;

      for (const inv of client.invoices) {
        if (inv.paidDate) {
          const delay = differenceInDays(new Date(inv.paidDate), new Date(inv.dueDate));
          if (delay > 0) sectorMap[sector].delays.push(delay);
        }
      }
    }

    return Object.entries(sectorMap).map(([sector, data]) => ({
      sector,
      clientCount: data.count,
      avgPdi: Math.round(data.pdis.reduce((s, v) => s + v, 0) / data.pdis.length),
      avgDelay: data.delays.length > 0
        ? Math.round(data.delays.reduce((s, v) => s + v, 0) / data.delays.length)
        : 0,
    })).sort((a, b) => a.avgPdi - b.avgPdi);
  }

  // ── DSO Monthly Trend ─────────────────────────
  async getDsoTrend(organizationId: string, months = 6) {
    const trend = [];
    for (let i = months - 1; i >= 0; i--) {
      const to = subMonths(new Date(), i);
      const dso = await this.invoicesService.calculateDSO(organizationId, 30);
      trend.push({ month: format(to, 'MMM yyyy'), dso });
    }
    return trend;
  }

  // ── Predictive Risk Score (rule-based model) ──
  async getPredictiveRisk(organizationId: string) {
    const clients = await this.prisma.client.findMany({
      where: { organizationId },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { status: true, dueDate: true, paidDate: true, invoiceAmount: true },
        },
        slaViolations: { select: { daysLate: true }, take: 20 },
      },
    });

    return clients.map(client => {
      const pdi = Number(client.paymentDisciplineIndex);
      const recentViolations = client.slaViolations.length;
      const avgDelay = client.slaViolations.length > 0
        ? client.slaViolations.reduce((s, v) => s + v.daysLate, 0) / client.slaViolations.length
        : 0;

      // Weighted risk score (0–100, higher = riskier)
      const riskScore = Math.min(100, Math.round(
        (100 - pdi) * 0.5 +
        Math.min(avgDelay, 30) * 1.2 +
        Math.min(recentViolations, 10) * 2,
      ));

      // Probability of late payment on next invoice
      const latePaymentProbability = Math.min(95, Math.max(5, 100 - pdi + (avgDelay * 0.8)));
      const expectedDelayDays = Math.round(avgDelay * (1 + (recentViolations * 0.05)));

      return {
        clientId: client.id,
        clientName: client.name,
        sector: client.sector,
        pdi,
        riskScore,
        latePaymentProbability: Math.round(latePaymentProbability),
        expectedDelayDays,
        riskStatus: client.riskStatus,
        recommendation: this.getRiskRecommendation(pdi, riskScore),
      };
    }).sort((a, b) => b.riskScore - a.riskScore);
  }

  // ── AI Insights (rule-based, swap for LLM) ────
  async getAiInsights(organizationId: string) {
    const [clients, sectorAnalysis, dso] = await Promise.all([
      this.prisma.client.findMany({
        where: { organizationId },
        select: {
          name: true, sector: true, paymentDisciplineIndex: true,
          riskStatus: true, isBlocked: true,
          slaViolations: { select: { daysLate: true }, take: 20 },
        },
      }),
      this.getSectorAnalysis(organizationId),
      this.invoicesService.calculateDSO(organizationId),
    ]);

    const insights: Array<{ type: string; severity: string; title: string; body: string }> = [];

    // Chronic clients insight
    const chronic = clients.filter(c => c.riskStatus === 'CHRONIC');
    if (chronic.length > 0) {
      insights.push({
        type: 'CLIENT_RISK',
        severity: 'critical',
        title: `${chronic.length} chronic delayer(s) detected`,
        body: `${chronic.map(c => c.name).join(', ')} ${chronic.length === 1 ? 'has' : 'have'} PDI below 40. Recommend immediate credit restriction and escalation to CFO.`,
      });
    }

    // High DSO insight
    if (dso > 45) {
      insights.push({
        type: 'DSO_ALERT',
        severity: 'warning',
        title: `DSO is ${dso} days — above target`,
        body: `Current DSO of ${dso} days exceeds the 38-day benchmark. Cash flow impact is significant. Focus collections on top 3 overdue accounts.`,
      });
    }

    // Sector trends
    const worstSector = sectorAnalysis[0];
    if (worstSector && worstSector.avgDelay > 10) {
      insights.push({
        type: 'SECTOR_PATTERN',
        severity: 'warning',
        title: `${worstSector.sector} sector shows payment stress`,
        body: `Clients in ${worstSector.sector} average ${worstSector.avgDelay} days late with a PDI of ${worstSector.avgPdi}. Consider sector-specific credit policy review.`,
      });
    }

    // Positive insight
    const reliable = clients.filter(c => c.riskStatus === 'RELIABLE');
    if (reliable.length > 0) {
      insights.push({
        type: 'POSITIVE',
        severity: 'info',
        title: `${reliable.length} reliable client(s) identified`,
        body: `${reliable.slice(0, 3).map(c => c.name).join(', ')} maintain excellent payment discipline (PDI ≥ 80). Consider extending preferential credit terms.`,
      });
    }

    return { insights, generatedAt: new Date().toISOString() };
  }

  // ── Report: CFO Weekly Summary ─────────────────
  async getCfoWeeklySummary(organizationId: string) {
    const weekAgo = subDays(new Date(), 7);
    const [kpis, newViolations, pdiChanges] = await Promise.all([
      this.getWeeklyKpis(organizationId, weekAgo),
      this.prisma.slaViolation.count({
        where: { client: { organizationId }, violationDate: { gte: weekAgo } },
      }),
      this.prisma.client.findMany({
        where: { organizationId, updatedAt: { gte: weekAgo } },
        select: { name: true, paymentDisciplineIndex: true, riskStatus: true },
      }),
    ]);

    return {
      period: { from: weekAgo, to: new Date() },
      kpis,
      newSlaViolations: newViolations,
      pdiChanges,
      generatedAt: new Date().toISOString(),
    };
  }

  private async getWeeklyKpis(organizationId: string, since: Date) {
    const [collected, newOverdue, followUpsLogged] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { client: { organizationId }, status: 'PAID', paidDate: { gte: since } },
        _sum: { invoiceAmount: true },
      }),
      this.prisma.invoice.count({
        where: { client: { organizationId }, status: 'OVERDUE', dueDate: { gte: since } },
      }),
      this.prisma.followUp.count({
        where: { invoice: { client: { organizationId } }, followUpDate: { gte: since } },
      }),
    ]);

    return {
      collectedThisWeek: Number(collected._sum.invoiceAmount ?? 0),
      newOverdueInvoices: newOverdue,
      followUpsLogged,
    };
  }

  private getRiskRecommendation(pdi: number, riskScore: number): string {
    if (pdi < 30) return 'Block immediately — auto-block threshold reached';
    if (pdi < 40) return 'Escalate to CFO — chronic payment behaviour';
    if (pdi < 60) return 'Reduce credit limit — high risk pattern';
    if (pdi < 80) return 'Monitor closely — moderate risk';
    return 'Maintain current terms — reliable payer';
  }
}
