import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
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

  async deactivate(id: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }
}
