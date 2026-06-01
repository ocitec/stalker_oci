#!/usr/bin/env node
/**
 * Prisma Migration Script
 * Workaround for Prisma 7 config file parsing issues
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env file
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set in .env file');
  process.exit(1);
}

console.log('🔄 Running Prisma migrations...');

try {
  // Set the environment variable for Prisma
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  
  const command = 'npx prisma migrate deploy --schema=prisma/schema.prisma';
  console.log(`📦 Executing: ${command}`);
  
  execSync(command, {
    env,
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  
  console.log('✅ Migrations completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
