import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

EventEmitter.defaultMaxListeners = 20;
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port         = configService.get<number>('port') || 3001;
  const frontendUrl  = configService.get<string>('frontend.url') || 'http://localhost:3000';
  const nodeEnv      = configService.get<string>('nodeEnv') || 'development';

  // ── Graceful shutdown: drains BullMQ jobs before process exits ─────────────
  app.enableShutdownHooks();

  // ── Security ───────────────────────────────────────────────────────────────
  app.use(helmet());

  app.enableCors({
    origin:      frontendUrl,
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ── Global pipes, filters & interceptors ───────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:        true,
      forbidNonWhitelisted: true,
      transform:        true,
      // transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // ── Global prefix ──────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Swagger (dev / staging only) ───────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('STALKER Cash Control API')
      .setDescription('Cashflow intelligence platform — reduces DSO and enforces payment discipline')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 STALKER API running on http://localhost:${port}/api/v1`);
  if (nodeEnv !== 'production') {
    logger.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
  }
}

bootstrap();
