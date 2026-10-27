import { loadEnv } from './config/env.js';
import { loadEnvFileIfPresent } from './config/load-env-file.js';
import { createLogger } from './shared/logger/logger.js';
import { getPrismaClient, disconnectPrisma } from './shared/prisma/prisma-client.js';
import { runSeed, type SeedStep } from './shared/seed/seed-runner.js';
import type { PrismaClient } from './shared/prisma/generated/client.js';

loadEnvFileIfPresent();

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const prisma = getPrismaClient(env);

  // Lista de pasos de semilla (cada HU posterior registra aquí sus pasos idempotentes)
  const seedSteps: SeedStep<PrismaClient>[] = [];

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
