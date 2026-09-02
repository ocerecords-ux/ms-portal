import { PrismaClient } from '@prisma/client';

// Standardni Next.js vzor - v dev rezimu znovupouzit jednu instanci Prisma
// klienta mezi hot-reloady, aby se nevycerpaly DB spojeni.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
