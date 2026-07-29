import {
  Injectable, NotFoundException, ConflictException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { CreateSupplierDto, UpdateSupplierDto, SupplierQueryDto } from './dto/supplier.dto';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  async create(dto: CreateSupplierDto, userId: string, organizationId: string) {
    if (dto.code) {
      const existing = await this.prisma.supplier.findUnique({ where: { code: dto.code } });
      if (existing) throw new ConflictException('Supplier code already exists');
    }
    const supplier = await this.prisma.supplier.create({ data: { ...dto, organizationId } });
    await this.audit.record({
      userId, action: 'SUPPLIER_CREATED', entity: 'Supplier', entityId: supplier.id,
      newValues: { name: supplier.name, code: supplier.code },
    });
    return supplier;
  }

  async findAll(organizationId: string, query: SupplierQueryDto) {
    const { page = 1, limit = 50, search, isActive } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.SupplierWhereInput = {
      organizationId,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where, skip, take: limit, orderBy: { name: 'asc' },
        include: { _count: { select: { paymentRequests: true } } },
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, organizationId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { paymentRequests: true } } },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto, organizationId: string, userId: string) {
    const supplier = await this.findOne(id, organizationId);
    if (dto.code && dto.code !== supplier.code) {
      const existing = await this.prisma.supplier.findFirst({ where: { code: dto.code, id: { not: id } } });
      if (existing) throw new ConflictException('Supplier code already exists');
    }
    const updated = await this.prisma.supplier.update({ where: { id }, data: dto });
    await this.audit.record({
      userId, action: 'SUPPLIER_UPDATED', entity: 'Supplier', entityId: id,
      oldValues: { name: supplier.name, isActive: supplier.isActive }, newValues: dto,
    });
    return updated;
  }
}
