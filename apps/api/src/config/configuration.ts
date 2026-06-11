import * as Joi from 'joi';

// ── Individual named config factories ────────────────────────────────────────
// These are what app.module.ts loads via ConfigModule.forRoot({ load: [...] })
// Each returns its own namespace so ConfigService.get('redis.host') works.

export const appConfig = () => ({
  port:    parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
});

export const databaseConfig = () => ({
  database: {
    url: process.env.DATABASE_URL,
  },
});

export const redisConfig = () => ({
  redis: {
    host:     process.env.REDIS_HOST     || 'localhost',
    port:     parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    url:      process.env.REDIS_URL      || undefined,
  },
});

export const jwtConfig = () => ({
  jwt: {
    secret:           process.env.JWT_SECRET,
    expiresIn:        process.env.JWT_EXPIRES_IN         || '15m',
    refreshSecret:    process.env.REFRESH_TOKEN_SECRET,
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
});

export const mailConfig = () => ({
  mail: {
    host: process.env.MAIL_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM || 'STALKER Cash Control <noreply@stalker-cashcontrol.com>',
  },
});

export const emailConfig = () => ({
  email: {
    postmarkApiKey: process.env.POSTMARK_API_KEY,
    resendApiKey:   process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || process.env.MAIL_FROM || 'STALKER Cash Control <noreply@stalker-cashcontrol.com>',
    financeEmail:   process.env.FINANCE_EMAIL,
  },
});

// ── Joi validation schema ────────────────────────────────────────────────────
// Wire into AppModule:
//   ConfigModule.forRoot({ validationSchema: configValidationSchema, ... })
export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().default(3001),

  // Database — hard required
  DATABASE_URL: Joi.string().uri().required().messages({
    'string.uri':   'DATABASE_URL must be a valid connection URI (e.g. postgresql://user:pass@host/db)',
    'any.required': 'DATABASE_URL is required',
  }),

  // Redis
  REDIS_HOST:     Joi.string().default('localhost'),
  REDIS_PORT:     Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(''),
  REDIS_URL:      Joi.string().optional().allow(''),

  // JWT — hard required, minimum 32 chars to enforce secure secrets
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min':   'JWT_SECRET must be at least 32 characters long',
    'any.required': 'JWT_SECRET is required',
  }),
  JWT_EXPIRES_IN: Joi.string().default('15m'),

  REFRESH_TOKEN_SECRET: Joi.string().min(32).required().messages({
    'string.min':   'REFRESH_TOKEN_SECRET must be at least 32 characters long',
    'any.required': 'REFRESH_TOKEN_SECRET is required',
  }),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),

  // Frontend
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  // Mail — legacy SMTP (optional)
  MAIL_HOST: Joi.string().default('smtp.mailtrap.io'),
  MAIL_PORT: Joi.number().default(587),
  MAIL_USER: Joi.string().optional().allow(''),
  MAIL_PASS: Joi.string().optional().allow(''),
  MAIL_FROM: Joi.string().optional().allow(''),

  // Email providers (at least one required for email delivery)
  POSTMARK_API_KEY: Joi.string().optional().allow(''),
  RESEND_API_KEY:   Joi.string().optional().allow(''),
  EMAIL_FROM:       Joi.string().optional().allow(''),
  FINANCE_EMAIL:    Joi.string().optional().allow(''),
});