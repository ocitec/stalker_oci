import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, Logger,
} from '@nestjs/common';
import { InvoiceStatus, ClientRisk, Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientQueryDto } from './dto/client-query.dto';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto, organizationId: string) {
    if (dto.companyRegistration) {
      const existing = await this.prisma.client.findUnique({
        where: { companyRegistration: dto.companyRegistration },
      });
      if (existing) throw new ConflictException('Company registration number already exists');
    }

    return this.prisma.client.create({
      data: { ...dto, organizationId },
    });
  }

  async findAll(organizationId: string, query: ClientQueryDto) {
    const { page = 1, limit = 20, search, riskStatus, sector, isBlocked } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {
      organizationId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { companyRegistration: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(riskStatus && { riskStatus }),
      ...(sector && { sector: { contains: sector, mode: 'insensitive' } }),
      ...(isBlocked !== undefined && { isBlocked }),
    };

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDisciplineIndex: 'asc' },
        include: {
          _count: { select: { invoices: true, slaViolations: true } },
          invoices: {
            where: { status: { in: ['OVERDUE', 'DUE_TODAY', 'PENDING'] } },
            select: { invoiceAmount: true, status: true },
          },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: clients.map(c => this.enrichClient(c)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, organizationId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, organizationId },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { followUps: { orderBy: { followUpDate: 'desc' }, take: 1 } },
        },
        slaViolations: { orderBy: { violationDate: 'desc' }, take: 10 },
        _count: { select: { invoices: true, slaViolations: true } },
      },
    });

    if (!client) throw new NotFoundException('Client not found');
    return this.enrichClient(client);
  }

  async update(id: string, dto: UpdateClientDto, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.client.delete({ where: { id } });
  }

  async blockClient(id: string, reason: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.client.update({
      where: { id },
      data: { isBlocked: true, blockedReason: reason },
    });
  }

  async unblockClient(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.client.update({
      where: { id },
      data: { isBlocked: false, blockedReason: null },
    });
  }

  // ── PDI Recalculation Engine ──────────────────
  async recalculatePDI(clientId: string): Promise<number> {
    const invoices = await this.prisma.invoice.findMany({
      where: { clientId, status: { in: ['PAID', 'OVERDUE'] } },
      select: { status: true, dueDate: true, paidDate: true },
    });

    if (invoices.length === 0) return 100;

    const onTimePayments = invoices.filter(inv => {
      if (inv.status === 'PAID' && inv.paidDate) {
        return inv.paidDate <= inv.dueDate;
      }
      return false;
    }).length;

    const totalInvoices = invoices.length;
    const pdi = Math.round((onTimePayments / totalInvoices) * 100);

    // Determine risk classification
    let riskStatus: ClientRisk;
    if (pdi >= 80) riskStatus = 'RELIABLE';
    else if (pdi >= 60) riskStatus = 'MODERATE';
    else if (pdi >= 40) riskStatus = 'HIGH_RISK';
    else riskStatus = 'CHRONIC';

    // Auto-block chronic clients
    const autoBlock = pdi < 30;

    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        paymentDisciplineIndex: pdi,
        riskStatus,
        ...(autoBlock && {
          isBlocked: true,
          blockedReason: `Auto-blocked: PDI dropped to ${pdi} (chronic delayer)`,
        }),
      },
    });

    this.logger.log(`PDI updated for client ${clientId}: ${pdi} (${riskStatus})`);
    return pdi;
  }

  async getPdiRanking(organizationId: string) {
    return this.prisma.client.findMany({
      where: { organizationId },
      orderBy: { paymentDisciplineIndex: 'asc' },
      select: {
        id: true, name: true, sector: true,
        paymentDisciplineIndex: true, riskStatus: true,
        isBlocked: true, creditLimit: true,
        _count: { select: { invoices: true, slaViolations: true } },
      },
    });
  }

  private enrichClient(client: any) {
    const outstanding = client.invoices?.reduce(
      (sum: number, inv: any) =>
        inv.status !== 'PAID' ? sum + Number(inv.invoiceAmount) : sum, 0,
    ) ?? 0;

    return {
      ...client,
      outstandingAmount: outstanding,
      utilizationPercent: client.creditLimit > 0
        ? Math.round((outstanding / Number(client.creditLimit)) * 100)
        : 0,
    };
  }
}
