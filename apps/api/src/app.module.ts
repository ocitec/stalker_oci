import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { PrismaModule } from './config/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { FollowUpsModule } from './modules/followups/followups.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { SlaModule } from './modules/sla/sla.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';

import {
  appConfig,
  databaseConfig,
  redisConfig,
  jwtConfig,
  mailConfig,
  emailConfig,
  configValidationSchema,
} from './config/configuration';

@Module({
  imports: [
    // ── Configuration ─────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig, mailConfig, emailConfig],
      envFilePath: ['.env.local', '.env'],
      validationSchema: configValidationSchema,   // ← validates env on boot
      validationOptions: {
        abortEarly: false,   // report ALL missing vars at once, not just the first
        allowUnknown: true,  // allow extra vars (e.g. PATH, HOME) without error
      },
    }),

    // ── Rate Limiting ──────────────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 20  },
      { name: 'medium', ttl: 10000, limit: 100 },
      { name: 'long',   ttl: 60000, limit: 500 },
    ]),

    // ── Cron Scheduler ────────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── BullMQ Task Queues ────────────────────────────────────────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host:     config.get('redis.host',     'localhost'),
          port:     config.get('redis.port',     6379),
          password: config.get('redis.password'),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail:     50,
          attempts:         3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      }),
    }),

    // ── Core Database ─────────────────────────────────────────────────────────
    PrismaModule,

    // ── Feature Modules ───────────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    ClientsModule,
    InvoicesModule,
    FollowUpsModule,
    AnalyticsModule,
    AlertsModule,
    SlaModule,
    DashboardModule,
    HealthModule,                    // ← GET /health + GET /health/ready
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}