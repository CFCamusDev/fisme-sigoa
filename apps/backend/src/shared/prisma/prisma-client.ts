import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';
import type { Env } from '../../config/env.js';

/**
 * Contenedor de un cliente Prisma no singleton con su pool de conexiones y método de cierre.
 */
export interface CreatedPrismaClient {
  prisma: PrismaClient;
  pool: pg.Pool;
  disconnect: () => Promise<void>;
}

/**
 * Crea una nueva instancia independiente de PrismaClient con su propio pool de conexiones (RS-040, RNF-014).
 * Permite conectarse a PostgreSQL con credenciales y roles diferenciados (ej. rol restringido sigoa_app).
 */
export function createPrismaClient(databaseUrl: string): CreatedPrismaClient {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  return {
    prisma,
    pool,
    disconnect: async () => {
      await prisma.$disconnect();
      await pool.end();
    },
  };
}

let prismaInstance: PrismaClient | null = null;
let currentClientHolder: CreatedPrismaClient | null = null;

/**
 * Obtiene la instancia singleton de PrismaClient para la aplicación.
 */
export function getPrismaClient(env: Env): PrismaClient {
  if (!prismaInstance) {
    currentClientHolder = createPrismaClient(env.DATABASE_URL);
    prismaInstance = currentClientHolder.prisma;
  }

  return prismaInstance;
}

/**
 * Desconecta la instancia singleton de PrismaClient y cierra su pool subyacente.
 */
export async function disconnectPrisma(): Promise<void> {
  if (currentClientHolder) {
    await currentClientHolder.disconnect();
    currentClientHolder = null;
    prismaInstance = null;
  }
}
