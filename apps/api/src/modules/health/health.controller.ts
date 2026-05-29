import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health:       HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly memory:       MemoryHealthIndicator,
    private readonly redisHealth:  RedisHealthIndicator,
  ) {}

  // GET /api/v1/health — liveness probe
  // Returns 200 as long as the process is alive and under memory limit.
  // Used by Docker / Kubernetes to decide whether to restart the container.
  @Get()
  @HealthCheck()
  liveness() {
    return this.health.check([
      () => this.memory.checkRSS('memory_rss', 512 * 1024 * 1024), // 512 MB
    ]);
  }

  // GET /api/v1/health/ready — readiness probe
  // Returns 200 only when DB and Redis are reachable.
  // Used by the load balancer to stop routing traffic before a rolling update.
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }
}