import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { Prisma, CreditRequestStatus } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { ExposureService } from '../../common/services/exposure.service';
import { makeReference } from '../../common/utils/reference.util';
import { CreateCreditRequestDto } from './dto/create-credit-request.dto';
import { CreditDecisionDto } from './dto/credit-decision.dto';
import { CreditQueryDto } from './dto/credit-query.dto';

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly audit:    AuditService,
    private readonly exposure: ExposureService,
  ) {}

  // ── CREATE (from an APPROVED sales request) ──────────────────────────────
  async create(dto: CreateCreditRequestDto, userId: string, organizationId: string) {
    const salesRequest = await this.prisma.salesRequest.findFirst({
      where:  { id: dto.salesRequestId, organizationId },
    });
    if (!salesRequest) throw new NotFoundException('Sales request not found');
    if (salesRequest.status !== 'APPROVED') {
      throw new BadRequestException(
        `Credit can only be assessed for an APPROVED sales request (current: ${salesRequest.status})`,
      );
    }

    const requestedAmount = dto.requestedAmount ?? Number(salesRequest.requestedAmount);

    const created = await this.prisma.creditRequest.create({
      data: {
        organizationId,
        reference:       dto.reference?.trim() || makeReference('CR'),
        salesRequestId:  salesRequest.id,
        clientId:        salesRequest.clientId,
        requestedAmount,
        currency:        dto.currency || salesRequest.currency,
        status:          'PENDING',
        comments:        dto.comments,
        createdById:     userId,
      },
      include: { client: { select: { id: true, name: true } } },
    });

    await this.audit.record({
      userId, action: 'CREDIT_REQUEST_CREATED', entity: 'CreditRequest',
      entityId: created.id,
      newValues: { reference: created.reference, salesRequestId: salesRequest.id, requestedAmount },
    });

    this.logger.log(`Credit request ${created.reference} created for sales ${salesRequest.reference}`);
    return created;
  }

  // ── LIST ─────────────────────────────────────────────────────────────────
  async findAll(organizationId: string, query: CreditQueryDto) {
    const { page = 1, limit = 20, status, clientId, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CreditRequestWhereInput = {
      organizationId,
      ...(status   && { status }),
      ...(clientId && { clientId }),
      ...(search && {
        OR: [
          { reference: { contains: search, mode: 'insensitive' } },
          { client:    { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.creditRequest.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client:       { select: { id: true, name: true, riskStatus: true, creditLimit: true, isBlocked: true } },
          salesRequest: { select: { id: true, reference: true } },
          decisionBy:   { select: { id: true, name: true } },
          _count:       { select: { transactions: true } },
        },
      }),
      this.prisma.creditRequest.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ── SINGLE (enriched with live exposure) ─────────────────────────────────
  async findOne(id: string, organizationId: string) {
    const cr = await this.prisma.creditRequest.findFirst({
      where: { id, organizationId },
      include: {
        client:       { select: { id: true, name: true, riskStatus: true, creditLimit: true, isBlocked: true, paymentDisciplineIndex: true } },
        salesRequest: { select: { id: true, reference: true, title: true } },
        decisionBy:   { select: { id: true, name: true } },
        transactions: { select: { id: true, reference: true, status: true } },
      },
    });
    if (!cr) throw new NotFoundException('Credit request not found');

    const exposure = await this.exposure.getClientExposure(cr.clientId);
    return { ...cr, exposure };
  }

  // ── DECISIONS ────────────────────────────────────────────────────────────
  approve(id: string, dto: CreditDecisionDto, organizationId: string, userId: string) {
    return this.decide(id, organizationId, userId, {
      from: ['PENDING', 'ON_HOLD'], to: 'APPROVED', action: 'CREDIT_REQUEST_APPROVED', dto,
    });
  }

  decline(id: string, dto: CreditDecisionDto, organizationId: string, userId: string) {
    return this.decide(id, organizationId, userId, {
      from: ['PENDING', 'ON_HOLD'], to: 'DECLINED', action: 'CREDIT_REQUEST_DECLINED', dto,
    });
  }

  hold(id: string, dto: CreditDecisionDto, organizationId: string, userId: string) {
    return this.decide(id, organizationId, userId, {
      from: ['PENDING'], to: 'ON_HOLD', action: 'CREDIT_REQUEST_HELD', dto,
    });
  }

  private async decide(
    id: string, organizationId: string, userId: string,
    opts: { from: CreditRequestStatus[]; to: CreditRequestStatus; action: string; dto: CreditDecisionDto },
  ) {
    const cr = await this.prisma.creditRequest.findFirst({ where: { id, organizationId } });
    if (!cr) throw new NotFoundException('Credit request not found');
    if (!opts.from.includes(cr.status)) {
      throw new BadRequestException(`Cannot ${opts.to.toLowerCase()} a credit request in status ${cr.status}`);
    }

    const approvedAmount = opts.to === 'APPROVED'
      ? (opts.dto.approvedAmount ?? Number(cr.requestedAmount))
      : null;

    const updated = await this.prisma.creditRequest.update({
      where: { id },
      data: {
        status:       opts.to,
        approvedAmount,
        comments:     opts.dto.comments ?? cr.comments,
        decisionById: userId,
        decisionAt:   new Date(),
      },
    });

    await this.audit.record({
      userId, action: opts.action, entity: 'CreditRequest', entityId: id,
      oldValues: { status: cr.status },
      newValues: { status: opts.to, approvedAmount, comments: opts.dto.comments },
    });

    this.logger.log(`Credit request ${cr.reference}: ${cr.status} → ${opts.to}`);
    return updated;
  }
}
