import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

export interface AuditEntry {
  userId?:    string | null;
  action:     string;
  entity:     string;
  entityId?:  string | null;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Shared, org-agnostic audit writer backed by the AuditLog model.
 *
 * Generalises the write-only helper that previously lived inside UsersService so
 * every financial-control module can record an immutable "who changed what, when"
 * trail. Writes are best-effort and never throw into the calling transaction.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId:    entry.userId    ?? null,
          action:    entry.action,
          entity:    entry.entity,
          entityId:  entry.entityId  ?? null,
          oldValues: entry.oldValues ?? undefined,
          newValues: entry.newValues ?? undefined,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (err) {
      // Audit is observability, not a hard dependency of the business action.
      this.logger.warn(
        `Audit write failed for ${entry.entity}:${entry.entityId ?? '-'} (${entry.action}) — ${String(err)}`,
      );
    }
  }
}
