import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class SlaService {
  constructor(private readonly prisma: PrismaService) {}

  async getViolations(organizationId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [violations, total] = await Promise.all([
      this.prisma.slaViolation.findMany({
        where: { client: { organizationId } },
        skip, take: limit,
        orderBy: { violationDate: 'desc' },
        include: {
          client: { select: { id: true, name: true, sector: true, paymentDisciplineIndex: true, riskStatus: true } },
          invoice: { select: { invoiceNumber: true, invoiceAmount: true, dueDate: true } },
        },
      }),
      this.prisma.slaViolation.count({ where: { client: { organizationId } } }),
    ]);
    return { data: violations, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getTopViolators(organizationId: string, limit = 10) {
    const result = await this.prisma.slaViolation.groupBy({
      by: ['clientId'],
      where: { client: { organizationId } },
      _count: { _all: true },
      _avg: { daysLate: true },
      _sum: { daysLate: true },
      orderBy: { _count: { clientId: 'desc' } },
      take: limit,
    });

    const clientIds = result.map(r => r.clientId);
    const clients = await this.prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, sector: true, paymentDisciplineIndex: true, riskStatus: true },
    });

    return result.map(r => ({
      ...r,
      client: clients.find(c => c.id === r.clientId),
      violationCount: r._count._all,
      avgDaysLate: Math.round(r._avg.daysLate ?? 0),
    }));
  }

  async getSummary(organizationId: string) {
    const [total, unresolved, avgDelay] = await Promise.all([
      this.prisma.slaViolation.count({ where: { client: { organizationId } } }),
      this.prisma.slaViolation.count({ where: { client: { organizationId }, resolved: false } }),
      this.prisma.slaViolation.aggregate({
        where: { client: { organizationId } },
        _avg: { daysLate: true },
      }),
    ]);
    return {
      totalViolations: total,
      unresolvedViolations: unresolved,
      averageDaysLate: Math.round(avgDelay._avg.daysLate ?? 0),
    };
  }
}
