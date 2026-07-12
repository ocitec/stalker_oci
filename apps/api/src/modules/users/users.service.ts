import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../config/prisma.service';
import { EmailJobName } from '../email/email.types';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('emails') private emailsQueue: Queue,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, organizationId: true, isActive: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateRole(id: string, role: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId },
      include: { organization: { select: { name: true } } },
    });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data:  { role: role as any },
    });

    await this.emailsQueue.add(
      EmailJobName.ROLE_CHANGED,
      {
        userId:           id,
        userName:         user.name,
        userEmail:        user.email,
        previousRole:     user.role,
        newRole:          role,
        organizationName: (user as any).organization?.name ?? '',
      },
      { jobId: `${EmailJobName.ROLE_CHANGED}:${id}:${role}` },
    );

    return updated;
  }

  async invite(
    dto: { name: string; email: string; role: string },
    organizationId: string,
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('A user with this email already exists');

    const tempPassword = uuidv4().replace(/-/g, '').slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash, role: dto.role as any, organizationId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    await this.emailsQueue.add(
      EmailJobName.WELCOME_USER,
      {
        userId:           user.id,
        userName:         user.name,
        userEmail:        user.email,
        role:             user.role,
        organizationName: org?.name ?? '',
        tempPassword,
      },
      { jobId: `${EmailJobName.WELCOME_USER}:${user.id}` },
    );

    return user;
  }

  async deactivate(id: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  async activate(id: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id }, data: { isActive: true } });
  }

  // ── Profile ────────────────────────────────────────────────────────────────
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, lastLoginAt: true, createdAt: true,
        organization: { select: { id: true, name: true, industry: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: { name?: string; email?: string }) {
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: userId } },
      });
      if (existing) throw new ConflictException('Email already in use');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data:  { ...(dto.name && { name: dto.name }), ...(dto.email && { email: dto.email }) },
      select: { id: true, name: true, email: true, role: true },
    });
    await this.writeAuditLog(userId, 'PROFILE_UPDATED', 'User', userId, dto);
    return updated;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.writeAuditLog(userId, 'PASSWORD_CHANGED', 'User', userId);
    return { message: 'Password updated successfully' };
  }

  async getActivity(userId: string, page = 1, limit = 20) {
    const skip  = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where: { userId } }),
    ]);
    return { logs, total, page, limit, pages: Math.ceil(total / limit) };
  }

  private async writeAuditLog(
    userId: string | null, action: string, entity: string, entityId?: string, newValues?: any,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { userId, action, entity, entityId: entityId ?? null, newValues: newValues ?? undefined },
      });
    } catch { /* non-fatal */ }
  }
}
