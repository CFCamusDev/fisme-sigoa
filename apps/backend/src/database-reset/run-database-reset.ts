import { seedAuthorization } from '../modules/authorization/infrastructure/prisma/seed/authorization-seed.js';
import {
  SEED_ADVISORY_LOCK_KEY,
  SEED_TRANSACTION_MAX_WAIT_MS,
  SEED_TRANSACTION_TIMEOUT_MS,
} from '../seed-database.js';
import type { PrismaClient } from '../shared/prisma/generated/client.js';
import { DatabaseResetRefusedError, decideDatabaseReset } from './reset-policy.js';
import { RESET_TABLES, findUnregisteredTables } from './reset-tables.js';

export const DEFAULT_RESET_LOCK_TIMEOUT_MS = 30_000;

export interface DatabaseResetLogger {
  info(message: string): void;
  warn?(message: string): void;
}

export interface RunDatabaseResetOptions {
  readonly prisma: PrismaClient;
  readonly rawEnv: Record<string, string | undefined>;
  readonly lockTimeoutMs?: number;
  readonly logger?: DatabaseResetLogger;
}

export type RunDatabaseResetResult =
  | { readonly action: 'SKIP' }
  | {
      readonly action: 'RESET';
      readonly databaseName: string;
      readonly deletedRowsByTable: Readonly<Record<string, number>>;
    };

/**
 * Ejecuta el reinicio controlado de datos de staging en una única transacción ACID (HU-081,
 * T-081-36). Serializa ejecuciones simultáneas con el bloqueo consultivo del seed y fija
 * `lock_timeout` para no quedar colgado esperando conexiones antiguas.
 */
export async function runDatabaseReset(
  options: RunDatabaseResetOptions,
): Promise<RunDatabaseResetResult> {
  const { prisma, rawEnv, lockTimeoutMs = DEFAULT_RESET_LOCK_TIMEOUT_MS, logger } = options;

  const decision = decideDatabaseReset({
    resetOnDeploy: rawEnv.DB_RESET_ON_DEPLOY,
    resetConfirm: rawEnv.DB_RESET_CONFIRM,
    databaseUrl: rawEnv.DATABASE_URL,
    appPublicUrl: rawEnv.APP_PUBLIC_URL,
  });

  if (decision.action === 'SKIP') {
    return { action: 'SKIP' };
  }

  const deletedRowsByTable: Record<string, number> = {};

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${SEED_ADVISORY_LOCK_KEY}))`;
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${lockTimeoutMs}ms'`);

      const existingRows = await tx.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `;
      const existingNames = existingRows.map((row) => row.tablename);
      const unregistered = findUnregisteredTables(existingNames);
      if (unregistered.length > 0) {
        throw new DatabaseResetRefusedError(
          `Hay tablas no registradas en el esquema public: ${unregistered.join(', ')}. Regístralas antes de reiniciar.`,
        );
      }

      for (const table of RESET_TABLES) {
        const countRows = await tx.$queryRawUnsafe<Array<{ total: number }>>(
          `SELECT COUNT(*)::int AS total FROM "${table}"`,
        );
        deletedRowsByTable[table] = countRows[0]?.total ?? 0;
      }

      const tableList = RESET_TABLES.map((table) => `"${table}"`).join(', ');
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY`);

      await seedAuthorization(tx, { restorePredefined: true });

      await tx.user.updateMany({
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    },
    { timeout: SEED_TRANSACTION_TIMEOUT_MS, maxWait: SEED_TRANSACTION_MAX_WAIT_MS },
  );

  const summary = RESET_TABLES.map((table) => `${table}=${deletedRowsByTable[table] ?? 0}`).join(
    ', ',
  );
  logger?.info(`[db:reset] Tablas vaciadas en ${decision.databaseName}: ${summary}`);
  logger?.info(
    `[db:reset] Reinicio completado en ${decision.databaseName}. Vuelve a poner DB_RESET_ON_DEPLOY=false antes del próximo despliegue.`,
  );

  return {
    action: 'RESET',
    databaseName: decision.databaseName,
    deletedRowsByTable,
  };
}
