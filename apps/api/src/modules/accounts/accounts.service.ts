import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { Prisma, ReplenishmentStatus } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { makeReference } from '../../common/utils/reference.util';
import { CreateAccountDto, UpdateAccountDto, AccountQueryDto } from './dto/account.dto';
import {
  CreateReplenishmentDto, ReplenishmentDecisionDto, ReplenishmentQueryDto,
} from './dto/replenishment.dto';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  // ── OPERATIONAL ACCOUNTS ─────────────────────────────────────────────────
  async createAccount(dto: CreateAccountDto, userId: string, organizationId: string) {
    const account = await this.prisma.operationalAccount.create({
      data: {
        organizationId,
        name:           dto.name,
        accountNumber:  dto.accountNumber,
        bankName:       dto.bankName,
        currency:       dto.currency || 'NGN',
        currentBalance: dto.currentBalance ?? 0,
        minimumBalance: dto.minimumBalance ?? 0,
      },
    });
    await this.audit.record({
      userId, action: 'ACCOUNT_CREATED', entity: 'OperationalAccount', entityId: account.id,
      newValues: { name: account.name, openingBalance: dto.currentBalance ?? 0 },
    });
    return this.serializeAccount(account);
  }

  async findAllAccounts(organizationId: string, query: AccountQueryDto) {
    const { page = 1, limit = 50, isActive } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.OperationalAccountWhereInput = { organizationId, ...(isActive !== undefined && { isActive }) };
    const [rows, total] = await Promise.all([
      this.prisma.operationalAccount.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.operationalAccount.count({ where }),
    ]);
    return { data: rows.map(a => this.serializeAccount(a)), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneAccount(id: string, organizationId: string) {
    const account = await this.prisma.operationalAccount.findFirst({
      where: { id, organizationId },
      include: { replenishments: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!account) throw new NotFoundException('Operational account not found');
    return this.serializeAccount(account);
  }

  async updateAccount(id: string, dto: UpdateAccountDto, organizationId: string, userId: string) {
    const account = await this.prisma.operationalAccount.findFirst({ where: { id, organizationId } });
    if (!account) throw new NotFoundException('Operational account not found');
    const updated = await this.prisma.operationalAccount.update({ where: { id }, data: dto });
    await this.audit.record({
      userId, action: 'ACCOUNT_UPDATED', entity: 'OperationalAccount', entityId: id, newValues: dto,
    });
    return this.serializeAccount(updated);
  }

  // ── REPLENISHMENTS ───────────────────────────────────────────────────────
  async createReplenishment(dto: CreateReplenishmentDto, userId: string, organizationId: string) {
    const account = await this.prisma.operationalAccount.findFirst({
      where: { id: dto.operationalAccountId, organizationId },
    });
    if (!account) throw new NotFoundException('Operational account not found');

    const created = await this.prisma.replenishment.create({
      data: {
        organizationId,
        reference:            makeReference('RPL'),
        operationalAccountId: account.id,
        requestedAmount:      dto.requestedAmount,
        requiredAmount:       dto.requiredAmount ?? dto.requestedAmount,
        status:               'PENDING',
        notes:                dto.notes,
        requestedById:        userId,
      },
    });
    await this.audit.record({
      userId, action: 'REPLENISHMENT_REQUESTED', entity: 'Replenishment', entityId: created.id,
      newValues: { account: account.name, requestedAmount: dto.requestedAmount },
    });
    return this.serializeReplenishment(created);
  }

  async findAllReplenishments(organizationId: string, query: ReplenishmentQueryDto) {
    const { page = 1, limit = 50, status, operationalAccountId } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.ReplenishmentWhereInput = {
      organizationId,
      ...(status && { status }),
      ...(operationalAccountId && { operationalAccountId }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.replenishment.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { operationalAccount: { select: { id: true, name: true, currency: true } } },
      }),
      this.prisma.replenishment.count({ where }),
    ]);
    return { data: rows.map(r => this.serializeReplenishment(r)), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  approveReplenishment(id: string, dto: ReplenishmentDecisionDto, organizationId: string, userId: string) {
    return this.decideReplenishment(id, organizationId, userId, {
      from: ['PENDING'], to: 'APPROVED', action: 'REPLENISHMENT_APPROVED', dto,
    });
  }

  declineReplenishment(id: string, dto: ReplenishmentDecisionDto, organizationId: string, userId: string) {
    return this.decideReplenishment(id, organizationId, userId, {
      from: ['PENDING'], to: 'DECLINED', action: 'REPLENISHMENT_DECLINED', dto,
    });
  }

  /** Fund an approved replenishment — credits the operational account balance atomically. */
  async fundReplenishment(id: string, organizationId: string, userId: string) {
    const rpl = await this.prisma.replenishment.findFirst({ where: { id, organizationId } });
    if (!rpl) throw new NotFoundException('Replenishment not found');
    if (rpl.status !== 'APPROVED') {
      throw new BadRequestException(`Only APPROVED replenishments can be funded (current: ${rpl.status})`);
    }
    const amount = Number(rpl.approvedAmount ?? rpl.requestedAmount);

    const [funded, account] = await this.prisma.$transaction([
      this.prisma.replenishment.update({
        where: { id }, data: { status: 'FUNDED', fundedAt: new Date() },
      }),
      this.prisma.operationalAccount.update({
        where: { id: rpl.operationalAccountId },
        data:  { currentBalance: { increment: amount } },
      }),
    ]);
    await this.audit.record({
      userId, action: 'REPLENISHMENT_FUNDED', entity: 'Replenishment', entityId: id,
      newValues: { amount, newBalance: Number(account.currentBalance) },
    });
    this.logger.log(`Replenishment ${rpl.reference} funded ${amount} → balance ${Number(account.currentBalance)}`);
    return this.serializeReplenishment(funded);
  }

  private async decideReplenishment(
    id: string, organizationId: string, userId: string,
    opts: { from: ReplenishmentStatus[]; to: ReplenishmentStatus; action: string; dto: ReplenishmentDecisionDto },
  ) {
    const rpl = await this.prisma.replenishment.findFirst({ where: { id, organizationId } });
    if (!rpl) throw new NotFoundException('Replenishment not found');
    if (!opts.from.includes(rpl.status)) {
      throw new BadRequestException(`Cannot ${opts.to.toLowerCase()} a replenishment in status ${rpl.status}`);
    }
    const approvedAmount = opts.to === 'APPROVED' ? (opts.dto.approvedAmount ?? Number(rpl.requestedAmount)) : null;
    const updated = await this.prisma.replenishment.update({
      where: { id },
      data: {
        status:       opts.to,
        approvedAmount,
        notes:        opts.dto.notes ?? rpl.notes,
        decisionById: userId,
        decisionAt:   new Date(),
      },
    });
    await this.audit.record({
      userId, action: opts.action, entity: 'Replenishment', entityId: id,
      oldValues: { status: rpl.status }, newValues: { status: opts.to, approvedAmount },
    });
    return this.serializeReplenishment(updated);
  }

  // ── serializers ──
  private serializeAccount(a: any) {
    return {
      ...a,
      currentBalance: Number(a.currentBalance),
      minimumBalance: Number(a.minimumBalance),
      belowMinimum:   Number(a.currentBalance) < Number(a.minimumBalance),
      ...(a.replenishments && {
        replenishments: a.replenishments.map((r: any) => this.serializeReplenishment(r)),
      }),
    };
  }

  private serializeReplenishment(r: any) {
    return {
      ...r,
      requiredAmount:  Number(r.requiredAmount),
      requestedAmount: Number(r.requestedAmount),
      approvedAmount:  r.approvedAmount != null ? Number(r.approvedAmount) : null,
    };
  }
}
