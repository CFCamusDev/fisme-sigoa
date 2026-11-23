import { loadBootstrapAdminEnv } from './config/bootstrap-admin-env.js';
import { BootstrapAdminUseCase } from './modules/users/application/bootstrap-admin.js';
import type { InitialPasswordHasher } from './modules/users/domain/ports/initial-password-hasher.js';
import { PrismaBootstrapAdminRepository } from './modules/users/infrastructure/prisma/prisma-bootstrap-admin-repository.js';
import { seedAuthorization } from './modules/authorization/infrastructure/prisma/seed/authorization-seed.js';
import { seedCatalogVersionDefaults } from './modules/catalog/infrastructure/prisma/seed/catalog-version-seed.js';
import { seedProgram } from './modules/parameters/infrastructure/prisma/seed/program-seed.js';
import { seedTemplateDefaults } from './modules/templates/infrastructure/prisma/seed/template-seed.js';
import { seedParameterDefaults } from './modules/parameters/infrastructure/prisma/seed/parameter-seed.js';
import { seedResponseScaleDefaults } from './modules/parameters/infrastructure/prisma/seed/response-scale-seed.js';
import type { PrismaClient } from './shared/prisma/generated/client.js';
import { runSeed, type SeedRunnerLogger, type SeedStep } from './shared/seed/seed-runner.js';

/** El seed completo (con el hash de argon2) puede superar los 5 s por defecto de Prisma. */
export const SEED_TRANSACTION_TIMEOUT_MS = 120_000;
export const SEED_TRANSACTION_MAX_WAIT_MS = 10_000;

/** Clave del bloqueo consultivo que serializa los seeds simultáneos (dos redeploys a la vez). */
export const SEED_ADVISORY_LOCK_KEY = 'sigoa:database-seed';

export interface RunDatabaseSeedOptions {
  readonly prisma: PrismaClient;
  /** Variables de entorno del proceso; solo se leen las ADMIN_* y solo si no hay administrador. */
  readonly rawEnv: Record<string, string | undefined>;
  readonly hasher: InitialPasswordHasher;
  readonly logger?: SeedRunnerLogger;
}

/**
 * Seed completo e idempotente de la base de datos (RNF-039). Se ejecuta en una única
 * transacción que toma primero un bloqueo consultivo: el segundo proceso espera,
 * ve el resultado del primero y no duplica nada (AGENTS §4.2 punto 7).
 */
export async function runDatabaseSeed(options: RunDatabaseSeedOptions): Promise<void> {
  const { prisma, rawEnv, hasher, logger } = options;

  // Lista de pasos de semilla (cada HU posterior registra aquí sus pasos idempotentes)
  const seedSteps: SeedStep<PrismaClient>[] = [
    {
      id: 'authorization-predefined-roles-and-permissions',
      run: async (tx) => {
        await seedAuthorization(tx);
      },
    },
    {
      id: 'parameters-program-epis',
      run: async (tx) => {
        await seedProgram(tx);
      },
    },
    {
      id: 'parameters-defaults',
      run: async (tx) => {
        await seedParameterDefaults(tx);
      },
    },
    {
      id: 'parameters-response-scales',
      run: async (tx) => {
        await seedResponseScaleDefaults(tx);
      },
    },
    {
      id: 'catalog-version-1',
      run: async (tx) => {
        await seedCatalogVersionDefaults(tx);
      },
    },
    {
      id: 'templates-v1',
      run: async (tx) => {
        await seedTemplateDefaults(tx);
      },
    },
    {
      id: 'users-bootstrap-first-administrator',
      run: async (tx) => {
        await new BootstrapAdminUseCase({
          repository: new PrismaBootstrapAdminRepository(tx),
          hasher,
          loadInput: () => loadBootstrapAdminEnv(rawEnv),
          logger,
        }).execute();
      },
    },
  ];

  await runSeed({
    steps: seedSteps,
    transaction: async <T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> => {
      return await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${SEED_ADVISORY_LOCK_KEY}))`;
          return await fn(tx as unknown as PrismaClient);
        },
        { timeout: SEED_TRANSACTION_TIMEOUT_MS, maxWait: SEED_TRANSACTION_MAX_WAIT_MS },
      );
    },
    logger,
  });
}
