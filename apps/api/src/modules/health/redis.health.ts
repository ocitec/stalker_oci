import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator
  extends HealthIndicator
  implements OnModuleDestroy
{
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    super();

    this.client = new Redis({
      host:                 this.configService.get<string>('redis.host', 'localhost'),
      port:                 this.configService.get<number>('redis.port', 6379),
      password:             this.configService.get<string>('redis.password'),
      // Fail fast — we only want a quick ping, not a retry storm
      lazyConnect:          true,
      maxRetriesPerRequest: 1,
      connectTimeout:       3000,
      enableOfflineQueue:   false,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const result = await this.client.ping();

      if (result !== 'PONG') {
        throw new Error(`Unexpected PING response: ${result}`);
      }

      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, { error: (err as Error).message }),
      );
    }
  }

  // Clean up the dedicated health-check connection when the app shuts down
  onModuleDestroy() {
    this.client.disconnect();
  }
}