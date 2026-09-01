import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InvoiceStatus, ClientRisk, Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientQueryDto } from './dto/client-query.dto';
import { EmailJobName } from '../email/email.types';
import { computeRecommendedAction } from '../../common/utils/action-recommendation.util';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @InjectQueue('emails') private emailsQueue: Queue,
  ) {}

  /** Collapse whitespace and trim so "MTN  Nigeria " and "MTN Nigeria" compare equal. */
  private normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }

  async create(dto: CreateClientDto, organizationId: string) {
    const name = this.normalizeName(dto.name);

    // Enforce a unique client name (case-insensitive) within the organization.
    const nameClash = await this.prisma.client.findFirst({
      where: { organizationId, name: { equals: name, mode: 'insensitive' } },
    });
    if (nameClash) {
      throw new ConflictException(`A client named "${name}" already exists`);
    }

    if (dto.companyRegistration) {
      const existing = await this.prisma.client.findUnique({
        where: { companyRegistration: dto.companyRegistration },
      });
      if (existing) throw new ConflictException('Company registration number already exists');
    }

    const client = await this.prisma.client.create({
      data: { ...dto, name, organizationId },
      include: { organization: { select: { name: true } } },
    });

    // Notify finance team of new client
    await this.emailsQueue.add(
      EmailJobName.NEW_CLIENT_ONBOARDED,
      {
        clientId:         client.id,
        clientName:       client.name,
        sector:           client.sector,
        creditLimit:      client.creditLimit,
        slaDays:          client.slaDays,
        organizationId,
        organizationName: (client as any).organization?.name ?? '',
      },
      { jobId: `${EmailJobName.NEW_CLIENT_ONBOARDED}:${client.id}` },
    );

    return client;
  }

  async findAll(organizationId: string, query: any) {
    const { page = 1, limit = 200, search, riskStatus, sector, isBlocked } = query;
    console.log('Querying clients with', query);
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

    const enriched = this.enrichClient(client);

    // Risk explanation: derived from sla violations and recent payment pattern
    const slaViolations: any[] = (client as any).slaViolations ?? [];
    const avgDelayDays = slaViolations.length > 0
      ? Math.round(slaViolations.reduce((s: number, v: any) => s + (v.daysLate ?? 0), 0) / slaViolations.length)
      : 0;
    const unresolvedSlaCount = slaViolations.filter((v: any) => !v.resolved).length;

    const recentInvoices = await this.prisma.invoice.findMany({
      where: { clientId: id, status: { in: ['PAID', 'OVERDUE'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { status: true, dueDate: true, paidDate: true },
    });

    const overallPdi = Number(client.paymentDisciplineIndex);
    let riskTrend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' = 'STABLE';
    if (recentInvoices.length >= 3) {
      const recentOnTime = recentInvoices.filter(
        inv => inv.status === 'PAID' && inv.paidDate && inv.paidDate <= inv.dueDate,
      ).length;
      const recentPdi = Math.round((recentOnTime / recentInvoices.length) * 100);
      if (recentPdi > overallPdi + 8) riskTrend = 'IMPROVING';
      else if (recentPdi < overallPdi - 8) riskTrend = 'DETERIORATING';
    }

    const outstandingAmount = enriched.outstandingAmount ?? 0;
    const utilizationPercent = enriched.utilizationPercent ?? 0;

    const overdueInvoices = (client as any).invoices?.filter(
      (inv: any) => ['OVERDUE', 'PARTIALLY_PAID'].includes(inv.status),
    ) ?? [];
    const today = new Date();
    const maxDaysOverdue = overdueInvoices.reduce((max: number, inv: any) => {
      const days = Math.max(0, Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000));
      return days > max ? days : max;
    }, 0);

    const recommendedAction = computeRecommendedAction({
      maxDaysOverdue,
      pdi: overallPdi,
      riskStatus: client.riskStatus,
      outstandingAmount,
      utilizationPercent,
      slaBreachCount: unresolvedSlaCount,
    });

    return {
      ...enriched,
      riskExplanation: {
        avgDelayDays,
        slaBreachCount: slaViolations.length,
        unresolvedSlaCount,
        riskTrend,
        recommendedAction,
      },
    };
  }

  async update(id: string, dto: UpdateClientDto, organizationId: string) {
    await this.findOne(id, organizationId);

    const data: Prisma.ClientUpdateInput = { ...dto };

    // Keep the client name unique (case-insensitive) within the organization.
    if (dto.name !== undefined) {
      const name = this.normalizeName(dto.name);
      const clash = await this.prisma.client.findFirst({
        where: { organizationId, id: { not: id }, name: { equals: name, mode: 'insensitive' } },
      });
      if (clash) throw new ConflictException(`A client named "${name}" already exists`);
      data.name = name;
    }

    // companyRegistration is globally unique — guard on edit too.
    if (dto.companyRegistration) {
      const clash = await this.prisma.client.findFirst({
        where: { companyRegistration: dto.companyRegistration, id: { not: id } },
      });
      if (clash) throw new ConflictException('Company registration number already exists');
    }

    return this.prisma.client.update({ where: { id }, data });
  }

  // ── DELETE (safeguarded) ────────────────────────────────────────────────────
  async remove(id: string, organizationId: string, userId?: string) {
    const client = await this.prisma.client.findFirst({ where: { id, organizationId } });
    if (!client) throw new NotFoundException('Client not found');

    // Safeguard: a client with any financial or control-chain history cannot be deleted.
    const [invoices, sales, credit, txns] = await Promise.all([
      this.prisma.invoice.count({ where: { clientId: id } }),
      this.prisma.salesRequest.count({ where: { clientId: id } }),
      this.prisma.creditRequest.count({ where: { clientId: id } }),
      this.prisma.transaction.count({ where: { clientId: id } }),
    ]);
    const blockers: string[] = [];
    if (invoices) blockers.push(`${invoices} invoice(s)`);
    if (sales)    blockers.push(`${sales} sales request(s)`);
    if (credit)   blockers.push(`${credit} credit request(s)`);
    if (txns)     blockers.push(`${txns} transaction(s)`);
    if (blockers.length) {
      throw new BadRequestException(
        `Cannot delete client "${client.name}" — it has ${blockers.join(', ')}. ` +
        `Consolidate duplicates or keep the client for audit history instead.`,
      );
    }

    // No financial history — safe to remove (clear any residual SLA rows defensively).
    await this.prisma.$transaction([
      this.prisma.slaViolation.deleteMany({ where: { clientId: id } }),
      this.prisma.client.delete({ where: { id } }),
    ]);

    await this.audit.record({
      userId: userId ?? null, action: 'CLIENT_DELETED', entity: 'Client', entityId: id,
      oldValues: { name: client.name, companyRegistration: client.companyRegistration },
    });
    this.logger.log(`Client "${client.name}" deleted`);
    return { id, deleted: true, name: client.name };
  }

  // ── CONSOLIDATION ───────────────────────────────────────────────────────────

  /** Dry-run: list groups of clients that share a normalized (case/space-insensitive) name. */
  async getDuplicates(organizationId: string) {
    const clients = await this.prisma.client.findMany({
      where:   { organizationId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { invoices: true, slaViolations: true, salesRequests: true, creditRequests: true, transactions: true },
        },
      },
    });

    const groups = new Map<string, typeof clients>();
    for (const c of clients) {
      const key = this.normalizeName(c.name).toLowerCase();
      const bucket = groups.get(key) ?? [];
      bucket.push(c);
      groups.set(key, bucket);
    }

    const duplicateGroups = [...groups.values()]
      .filter(members => members.length > 1)
      .map(members => {
        // Suggest the record with the most invoices as survivor; tie-break on earliest created.
        const survivor = [...members].sort(
          (a, b) => (b._count.invoices - a._count.invoices) || (a.createdAt.getTime() - b.createdAt.getTime()),
        )[0];
        return {
          name:                members[0].name,
          count:               members.length,
          suggestedSurvivorId: survivor.id,
          clients: members.map(m => ({
            id:                  m.id,
            name:                m.name,
            email:               m.email,
            companyRegistration: m.companyRegistration,
            createdAt:           m.createdAt,
            creditLimit:         Number(m.creditLimit),
            pdi:                 Number(m.paymentDisciplineIndex),
            isBlocked:           m.isBlocked,
            counts:              m._count,
          })),
        };
      });

    return { duplicateGroups, totalGroups: duplicateGroups.length };
  }

  /** Merge duplicate clients into a survivor: reassign all related records, then delete the duplicates. */
  async merge(survivorId: string, duplicateIds: string[], organizationId: string, userId?: string) {
    const ids = [...new Set(duplicateIds)].filter(d => d && d !== survivorId);
    if (ids.length === 0) {
      throw new BadRequestException('Provide at least one duplicate client id (different from the survivor)');
    }

    const survivor = await this.prisma.client.findFirst({ where: { id: survivorId, organizationId } });
    if (!survivor) throw new NotFoundException('Survivor client not found');

    const dups = await this.prisma.client.findMany({ where: { id: { in: ids }, organizationId } });
    if (dups.length !== ids.length) {
      throw new BadRequestException('One or more duplicate clients were not found in this organization');
    }

    // Reassign every client-referencing record to the survivor, then delete the duplicates — atomically.
    const ops: Prisma.PrismaPromise<any>[] = [];
    for (const dupId of ids) {
      ops.push(this.prisma.invoice.updateMany({ where: { clientId: dupId }, data: { clientId: survivorId } }));
      ops.push(this.prisma.slaViolation.updateMany({ where: { clientId: dupId }, data: { clientId: survivorId } }));
      ops.push(this.prisma.salesRequest.updateMany({ where: { clientId: dupId }, data: { clientId: survivorId } }));
      ops.push(this.prisma.creditRequest.updateMany({ where: { clientId: dupId }, data: { clientId: survivorId } }));
      ops.push(this.prisma.transaction.updateMany({ where: { clientId: dupId }, data: { clientId: survivorId } }));
    }
    ops.push(this.prisma.client.deleteMany({ where: { id: { in: ids }, organizationId } }));
    await this.prisma.$transaction(ops);

    // Recalculate the survivor's PDI over the consolidated invoice history.
    await this.recalculatePDI(survivorId);

    await this.audit.record({
      userId: userId ?? null, action: 'CLIENTS_MERGED', entity: 'Client', entityId: survivorId,
      newValues: { survivorId, mergedClientIds: ids, mergedNames: dups.map(d => d.name) },
    });
    this.logger.log(`Merged ${ids.length} client(s) into "${survivor.name}" (${survivorId})`);

    const survivorInvoices = await this.prisma.invoice.count({ where: { clientId: survivorId } });
    return { survivorId, survivorName: survivor.name, merged: ids.length, survivorInvoices };
  }

  async blockClient(id: string, reason: string, organizationId: string, blockedBy?: string) {
    const client = await this.findOne(id, organizationId);

    const updated = await this.prisma.client.update({
      where: { id },
      data:  { isBlocked: true, blockedReason: reason },
    });

    // Notify the client
    if (client.email) {
      const date = new Date().toISOString().split('T')[0];
      await this.emailsQueue.add(
        EmailJobName.ACCOUNT_BLOCKED,
        {
          clientId:     id,
          clientName:   client.name,
          clientEmail:  client.email,
          blockedReason: reason,
          isAutoBlock:  false,
        },
        { jobId: `${EmailJobName.ACCOUNT_BLOCKED}:${id}:${date}` },
      );
    }

    // Audit trail to CFO/Admin
    await this.emailsQueue.add(
      EmailJobName.CLIENT_BLOCKED_AUDIT,
      {
        clientId:      id,
        clientName:    client.name,
        blockedReason: reason,
        blockedBy,
        organizationId,
      },
      { jobId: `${EmailJobName.CLIENT_BLOCKED_AUDIT}:${id}:${new Date().toISOString().split('T')[0]}` },
    );

    return updated;
  }

  async unblockClient(id: string, organizationId: string) {
    const client = await this.findOne(id, organizationId);

    const updated = await this.prisma.client.update({
      where: { id },
      data:  { isBlocked: false, blockedReason: null },
    });

    if (client.email) {
      const date = new Date().toISOString().split('T')[0];
      await this.emailsQueue.add(
        EmailJobName.ACCOUNT_UNBLOCKED,
        {
          clientId:    id,
          clientName:  client.name,
          clientEmail: client.email,
        },
        { jobId: `${EmailJobName.ACCOUNT_UNBLOCKED}:${id}:${date}` },
      );
    }

    return updated;
  }

  // ── PDI Recalculation Engine ───────────────────────────────────────────────
  async recalculatePDI(clientId: string): Promise<number> {
    const client = await this.prisma.client.findUnique({
      where:  { id: clientId },
      select: { riskStatus: true, organizationId: true, name: true, email: true, isBlocked: true, slaViolations: { select: { id: true } } },
    });

    const invoices = await this.prisma.invoice.findMany({
      where:  { clientId, status: { in: ['PAID', 'OVERDUE'] } },
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

    let newRisk: ClientRisk;
    if      (pdi >= 80) newRisk = 'RELIABLE';
    else if (pdi >= 60) newRisk = 'MODERATE';
    else if (pdi >= 40) newRisk = 'HIGH_RISK';
    else                newRisk = 'CHRONIC';

    const autoBlock    = pdi < 30;
    const previousRisk = client?.riskStatus;
    const orgId        = client?.organizationId ?? '';

    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        paymentDisciplineIndex: pdi,
        riskStatus: newRisk,
        ...(autoBlock && {
          isBlocked:     true,
          blockedReason: `Auto-blocked: PDI dropped to ${pdi} (chronic delayer)`,
        }),
      },
    });

    // Risk status change notification (only on downgrade, not first-run RELIABLE)
    if (previousRisk && previousRisk !== newRisk && orgId) {
      const date = new Date().toISOString().split('T')[0];
      await this.emailsQueue.add(
        EmailJobName.RISK_STATUS_CHANGED,
        {
          clientId,
          clientName:   client!.name,
          previousRisk,
          newRisk,
          pdiScore:     pdi,
          organizationId: orgId,
        },
        { jobId: `${EmailJobName.RISK_STATUS_CHANGED}:${clientId}:${newRisk}:${date}` },
      );
    }

    // Auto-block notifications
    if (autoBlock && !client?.isBlocked && orgId) {
      const date = new Date().toISOString().split('T')[0];

      if (client?.email) {
        await this.emailsQueue.add(
          EmailJobName.ACCOUNT_BLOCKED,
          {
            clientId,
            clientName:    client.name,
            clientEmail:   client.email,
            blockedReason: `Auto-blocked: PDI dropped to ${pdi} (chronic delayer)`,
            isAutoBlock:   true,
            pdiScore:      pdi,
          },
          { jobId: `${EmailJobName.ACCOUNT_BLOCKED}:${clientId}:${date}` },
        );
      }

      await this.emailsQueue.add(
        EmailJobName.PDI_WARNING,
        {
          clientId,
          clientName:    client!.name,
          clientEmail:   client?.email ?? '',
          pdiScore:      pdi,
          isBlocked:     true,
          organizationId: orgId,
        },
        { jobId: `${EmailJobName.PDI_WARNING}:${clientId}:${date}` },
      );

      await this.emailsQueue.add(
        EmailJobName.CLIENT_BLOCKED_AUDIT,
        {
          clientId,
          clientName:    client!.name,
          blockedReason: `Auto-blocked: PDI dropped to ${pdi} (chronic delayer)`,
          organizationId: orgId,
        },
        { jobId: `${EmailJobName.CLIENT_BLOCKED_AUDIT}:${clientId}:${date}` },
      );
    }

    // Chronic client escalation (PDI < 40 but not yet at auto-block threshold)
    if (newRisk === 'CHRONIC' && !autoBlock && orgId) {
      const totalViolations = client?.slaViolations?.length ?? 0;
      const date = new Date().toISOString().split('T')[0];
      await this.emailsQueue.add(
        EmailJobName.CHRONIC_CLIENT,
        {
          clientId,
          clientName:     client!.name,
          pdiScore:       pdi,
          totalViolations,
          organizationId: orgId,
        },
        { jobId: `${EmailJobName.CHRONIC_CLIENT}:${clientId}:${date}` },
      );
    }

    this.logger.log(`PDI updated for client ${clientId}: ${pdi} (${newRisk})`);
    return pdi;
  }

  async getPdiRanking(organizationId: string) {
    return this.prisma.client.findMany({
      where:   { organizationId },
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
