import {
  Injectable, UnauthorizedException, ConflictException,
  BadRequestException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';
import { PrismaService } from '../../config/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  // ── Register ──────────────────────────────────
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create org and user in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      let org = await tx.organization.findFirst({ where: { name: dto.organizationName } });
      if (!org) {
        org = await tx.organization.create({
          data: { name: dto.organizationName, industry: dto.industry },
        });
      }
      return tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: dto.role || 'FINANCE',
          organizationId: org.id,
        },
        select: { id: true, name: true, email: true, role: true, organizationId: true },
      });
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);
    this.logger.log(`New user registered: ${user.email}`);
    return { user, ...tokens };
  }

  // ── Login ─────────────────────────────────────
  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { organization: { select: { id: true, name: true } } },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValidPassword) throw new UnauthorizedException('Invalid credentials');

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User logged in: ${user.email} from ${ipAddress}`);

    return {
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, organization: user.organization,
      },
      ...tokens,
    };
  }

  // ── Refresh Tokens ────────────────────────────
  async refreshTokens(refreshToken: string) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!tokenRecord.user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Rotate: delete old, issue new
    await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
    const tokens = await this.generateTokens(
      tokenRecord.user.id, tokenRecord.user.email, tokenRecord.user.role,
    );
    await this.saveRefreshToken(tokenRecord.user.id, tokens.refreshToken);
    return tokens;
  }

  // ── Logout ────────────────────────────────────
  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }

  // ── Validate (Passport) ───────────────────────
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  // ── Token Generation ──────────────────────────
  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.secret'),
        expiresIn: this.configService.get('jwt.accessExpiry', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.refreshSecret'),
        expiresIn: this.configService.get('jwt.refreshExpiry', '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string) {
    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt: addDays(new Date(), 7),
      },
    });
  }
}
