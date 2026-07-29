import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { Prisma, SalesRequestStatus } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { makeReference } from '../../common/utils/reference.util';
import { CreateSalesRequestDto } from './dto/create-sales-request.dto';
import { UpdateSalesRequestDto, DecisionDto } from './dto/update-sales-request.dto';
import { SalesQueryDto } from './dto/sales-query.dto';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  // ── CREATE ───────────────────────────────────────────────────────────────
  async create(dto: CreateSalesRequestDto, userId: string, organizationId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, organizationId },
    });
    if (!client) throw new NotFoundException('Client not found');

    const status: SalesRequestStatus = dto.submit ? 'SUBMITTED' : 'DRAFT';

    const created = await this.prisma.salesRequest.create({
      data: {
        organizationId,
        reference:       dto.reference?.trim() || makeReference('SR'),
        clientId:        dto.clientId,
        title:           dto.title,
        description:     dto.description,
        requestedAmount: dto.requestedAmount,
        currency:        dto.currency || 'NGN',
        status,
        createdById:     userId,
        submittedAt:     dto.submit ? new Date() : null,
      },
      include: { client: { select: { id: true, name: true } } },
    });

    await this.audit.record({
      userId, action: 'SALES_REQUEST_CREATED', entity: 'SalesRequest',
      entityId: created.id, newValues: { reference: created.reference, status, amount: dto.requestedAmount },
    });

    this.logger.log(`Sales request ${created.reference} created (${status})`);
    return created;
  }

  // ── LIST ─────────────────────────────────────────────────────────────────
  async findAll(organizationId: string, query: SalesQueryDto) {
    const { page = 1, limit = 20, status, clientId, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SalesRequestWhereInput = {
      organizationId,
      ...(status   && { status }),
      ...(clientId && { clientId }),
      ...(search && {
        OR: [
          { reference: { contains: search, mode: 'insensitive' } },
          { title:     { contains: search, mode: 'insensitive' } },
          { client:    { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.salesRequest.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client:    { select: { id: true, name: true, riskStatus: true } },
          createdBy: { select: { id: true, name: true } },
          _count:    { select: { creditRequests: true, transactions: true } },
        },
      }),
      this.prisma.salesRequest.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ── SINGLE ───────────────────────────────────────────────────────────────
  async findOne(id: string, organizationId: string) {
    const sr = await this.prisma.salesRequest.findFirst({
      where: { id, organizationId },
      include: {
        client:    { select: { id: true, name: true, riskStatus: true, creditLimit: true } },
        createdBy: { select: { id: true, name: true } },
        creditRequests: { orderBy: { createdAt: 'desc' } },
        transactions:   { select: { id: true, reference: true, status: true } },
      },
    });
    if (!sr) throw new NotFoundException('Sales request not found');
    return sr;
  }

  // ── UPDATE (DRAFT only) ──────────────────────────────────────────────────
  async update(id: string, dto: UpdateSalesRequestDto, organizationId: string, userId: string) {
    const sr = await this.findOne(id, organizationId);
    if (sr.status !== 'DRAFT') {
      throw new BadRequestException(`Only DRAFT sales requests can be edited (current: ${sr.status})`);
    }
    const updated = await this.prisma.salesRequest.update({
      where: { id },
      data: {
        ...(dto.title           !== undefined && { title: dto.title }),
        ...(dto.description      !== undefined && { description: dto.description }),
        ...(dto.requestedAmount  !== undefined && { requestedAmount: dto.requestedAmount }),
        ...(dto.currency         !== undefined && { currency: dto.currency }),
      },
    });
    await this.audit.record({
      userId, action: 'SALES_REQUEST_UPDATED', entity: 'SalesRequest',
      entityId: id, oldValues: { title: sr.title, amount: sr.requestedAmount }, newValues: dto,
    });
    return updated;
  }

  // ── WORKFLOW TRANSITIONS ─────────────────────────────────────────────────
  submit(id: string, organizationId: string, userId: string) {
    return this.transition(id, organizationId, userId, {
      from: ['DRAFT'], to: 'SUBMITTED', action: 'SALES_REQUEST_SUBMITTED',
      extra: { submittedAt: new Date() },
    });
  }

  approve(id: string, organizationId: string, userId: string) {
    return this.transition(id, organizationId, userId, {
      from: ['SUBMITTED'], to: 'APPROVED', action: 'SALES_REQUEST_APPROVED',
    });
  }

  reject(id: string, dto: DecisionDto, organizationId: string, userId: string) {
    return this.transition(id, organizationId, userId, {
      from: ['SUBMITTED'], to: 'REJECTED', action: 'SALES_REQUEST_REJECTED',
    });
  }

  cancel(id: string, organizationId: string, userId: string) {
    return this.transition(id, organizationId, userId, {
      from: ['DRAFT', 'SUBMITTED'], to: 'CANCELLED', action: 'SALES_REQUEST_CANCELLED',
    });
  }

  private async transition(
    id: string, organizationId: string, userId: string,
    opts: { from: SalesRequestStatus[]; to: SalesRequestStatus; action: string; extra?: Record<string, any> },
  ) {
    const sr = await this.findOne(id, organizationId);
    if (!opts.from.includes(sr.status)) {
      throw new BadRequestException(
        `Cannot ${opts.to.toLowerCase()} a sales request in status ${sr.status}`,
      );
    }
    const updated = await this.prisma.salesRequest.update({
      where: { id },
      data:  { status: opts.to, ...opts.extra },
    });
    await this.audit.record({
      userId, action: opts.action, entity: 'SalesRequest', entityId: id,
      oldValues: { status: sr.status }, newValues: { status: opts.to },
    });
    this.logger.log(`Sales request ${sr.reference}: ${sr.status} → ${opts.to}`);
    return updated;
  }
}
