import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../src/config/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(PrismaHealthIndicator.name);
  private readonly timeout = 5000; // 5 second timeout

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const query = this.prisma.$queryRaw`SELECT 1`;
      await Promise.race([
        query,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Database health check timeout')),
            this.timeout,
          ),
        ),
      ]);

      this.logger.debug('Database health check passed');
      return this.getStatus(key, true);
    } catch (err: unknown) {
      const errorMessage = this.getErrorMessage(err);
      this.logger.error(`Database health check failed: ${errorMessage}`, err);

      throw new HealthCheckError(
        'Prisma health check failed',
        this.getStatus(key, false, { error: errorMessage }),
      );
    }
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    if (typeof err === 'string') {
      return err;
    }
    return 'Unknown database error';
  }
}
