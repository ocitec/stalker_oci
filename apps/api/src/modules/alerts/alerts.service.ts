import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, isRead?: boolean) {
    return this.prisma.alert.findMany({
      where: {
        invoice: { client: { organizationId } },
        ...(isRead !== undefined && { isRead }),
      },
      orderBy: { sentAt: 'desc' },
      take: 50,
      include: {
        invoice: {
          select: {
            invoiceNumber: true, invoiceAmount: true, dueDate: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async markRead(id: string) {
    return this.prisma.alert.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(organizationId: string) {
    return this.prisma.alert.updateMany({
      where: {
        isRead: false,
        invoice: { client: { organizationId } },
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getUnreadCount(organizationId: string) {
    return this.prisma.alert.count({
      where: {
        isRead: false,
        invoice: { client: { organizationId } },
      },
    });
  }
}
