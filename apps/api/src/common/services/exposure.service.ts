import { Injectable } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

/** Invoice statuses that still count as outstanding credit exposure. */
const ACTIVE_INVOICE_STATUSES: InvoiceStatus[] = ['PENDING', 'DUE_TODAY', 'OVERDUE', 'PARTIALLY_PAID'];

export interface ClientExposure {
  creditLimit:        number;
  currentExposure:    number;
  availableCredit:    number;
  utilizationPercent: number;
}

/**
 * Authoritative credit-exposure calculator for a client — the sum of remaining
 * balances across active invoices. Mirrors the ad-hoc math in ClientsService and
 * the credit-limit-breach check in InvoicesService, centralised so Credit Control
 * and Transaction Control share one definition of "current exposure".
 */
@Injectable()
export class ExposureService {
  constructor(private readonly prisma: PrismaService) {}

  async getClientExposure(clientId: string): Promise<ClientExposure> {
    const client = await this.prisma.client.findUnique({
      where:  { id: clientId },
      select: { creditLimit: true },
    });
    const creditLimit = Number(client?.creditLimit ?? 0);

    const agg = await this.prisma.invoice.aggregate({
      where: { clientId, status: { in: ACTIVE_INVOICE_STATUSES } },
      _sum:  { remainingBalance: true },
    });
    const currentExposure    = Number(agg._sum.remainingBalance ?? 0);
    const availableCredit    = creditLimit > 0 ? Math.max(0, creditLimit - currentExposure) : 0;
    const utilizationPercent = creditLimit > 0 ? Math.round((currentExposure / creditLimit) * 100) : 0;

    return { creditLimit, currentExposure, availableCredit, utilizationPercent };
  }
}
