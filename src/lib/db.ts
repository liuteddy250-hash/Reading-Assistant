import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function databaseUrl(): string {
  return process.env.DATABASE_URL || 'file:./prisma/dev.db';
}

const adapter = new PrismaBetterSqlite3({ url: databaseUrl() });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
