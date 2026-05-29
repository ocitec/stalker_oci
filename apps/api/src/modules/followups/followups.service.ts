import { Injectable, NotFoundException } from '@nestjs/common';
import { differenceInDays } from 'date-fns';
import { PrismaService } from '../../config/prisma.service';
import { CreateFollowUpDto } from './dto/create-followup.dto';

@Injectable()
export class FollowUpsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFollowUpDto, userId: string, organizationId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, client: { organizationId } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const followUp = await this.prisma.followUp.create({
      data: {
        invoiceId: dto.invoiceId,
        userId,
        followUpType: dto.followUpType,
        notes: dto.notes,
        responseReceived: dto.responseReceived ?? false,
        nextFollowUpDate: dto.nextFollowUpDate ? new Date(dto.nextFollowUpDate) : undefined,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        invoice: {
          select: {
            invoiceNumber: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Clear stale follow-up alert
    await this.prisma.alert.updateMany({
      where: { invoiceId: dto.invoiceId, alertType: 'FOLLOW_UP_STALE', isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return followUp;
  }

  async findAll(organizationId: string, invoiceId?: string) {
    return this.prisma.followUp.findMany({
      where: {
        invoice: { client: { organizationId } },
        ...(invoiceId && { invoiceId }),
      },
      orderBy: { followUpDate: 'desc' },
      include: {
        user: { select: { id: true, name: true, role: true } },
        invoice: {
          select: {
            invoiceNumber: true, invoiceAmount: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async getFollowUpCompliance(organizationId: string) {
    const today = new Date();
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const [overdueInvoices, recentFollowUps, totalFollowUps] = await Promise.all([
      this.prisma.invoice.count({
        where: { status: 'OVERDUE', client: { organizationId } },
      }),
      this.prisma.followUp.count({
        where: {
          followUpDate: { gte: fiveDaysAgo },
          invoice: { client: { organizationId } },
        },
      }),
      this.prisma.followUp.count({
        where: { invoice: { client: { organizationId } } },
      }),
    ]);

    // Invoices with no follow-up in last 5 days
    const staleInvoices = await this.prisma.invoice.findMany({
      where: {
        status: 'OVERDUE',
        client: { organizationId },
        followUps: { none: { followUpDate: { gte: fiveDaysAgo } } },
      },
      select: {
        id: true, invoiceNumber: true, invoiceAmount: true, dueDate: true,
        client: { select: { id: true, name: true } },
        followUps: { orderBy: { followUpDate: 'desc' }, take: 1 },
      },
    });

    const enriched = staleInvoices.map(inv => {
      const last = inv.followUps[0];
      return {
        ...inv,
        daysSinceFollowUp: last
          ? differenceInDays(today, new Date(last.followUpDate))
          : differenceInDays(today, new Date(inv.dueDate)),
        daysOverdue: differenceInDays(today, new Date(inv.dueDate)),
      };
    });

    return {
      overdueInvoices,
      staleCount: enriched.length,
      recentFollowUps,
      totalFollowUps,
      complianceRate: overdueInvoices > 0
        ? Math.round(((overdueInvoices - enriched.length) / overdueInvoices) * 100)
        : 100,
      staleInvoices: enriched.sort((a, b) => b.daysSinceFollowUp - a.daysSinceFollowUp),
    };
  }
}
