import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';
import type { Env } from '../../config/env.js';

let prismaInstance: PrismaClient | null = null;
let poolInstance: pg.Pool | null = null;

export function getPrismaClient(env: Env): PrismaClient {
  if (!prismaInstance) {
    poolInstance = new pg.Pool({
      connectionString: env.DATABASE_URL,
    });
    const adapter = new PrismaPg(poolInstance);
    prismaInstance = new PrismaClient({ adapter });
  }

  return prismaInstance;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
