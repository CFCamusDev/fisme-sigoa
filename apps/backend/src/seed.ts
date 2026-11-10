import { loadEnv } from './config/env.js';
import { loadEnvFileIfPresent } from './config/load-env-file.js';
import { createLogger } from './shared/logger/logger.js';
import { getPrismaClient, disconnectPrisma } from './shared/prisma/prisma-client.js';
import { runSeed, type SeedStep } from './shared/seed/seed-runner.js';
import type { PrismaClient } from './shared/prisma/generated/client.js';
import { seedAuthorization } from './modules/authorization/infrastructure/prisma/seed/authorization-seed.js';
import { seedProgram } from './modules/parameters/infrastructure/prisma/seed/program-seed.js';
import { seedParameterDefaults } from './modules/parameters/infrastructure/prisma/seed/parameter-seed.js';

loadEnvFileIfPresent();

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const prisma = getPrismaClient(env);

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
  ];

  try {
    await runSeed({
      steps: seedSteps,
      transaction: async <T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> => {
        return await prisma.$transaction(async (tx) => {
          return await fn(tx as unknown as PrismaClient);
        });
      },
      logger,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error executing database seed');
    process.exit(1);
  } finally {
    await disconnectPrisma();
  }
}

void main();
