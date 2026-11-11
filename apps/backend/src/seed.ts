import { loadEnv } from './config/env.js';
import { loadEnvFileIfPresent } from './config/load-env-file.js';
import { Argon2PasswordHasher } from './modules/auth/infrastructure/security/argon2-password-hasher.js';
import { runDatabaseSeed } from './seed-database.js';
import { createLogger } from './shared/logger/logger.js';
import { getPrismaClient, disconnectPrisma } from './shared/prisma/prisma-client.js';

loadEnvFileIfPresent();

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const prisma = getPrismaClient(env);

  try {
    await runDatabaseSeed({
      prisma,
      rawEnv: process.env,
      hasher: new Argon2PasswordHasher(),
      logger: {
        info: (message) => logger.info(message),
        warn: (message) => logger.warn(message),
        error: (message, ...args) => logger.error({ detail: args[0] }, message),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Error executing database seed');
    // Mensaje legible para el log del contenedor `migrate` (qué variable corregir)
    const safeMessage = error instanceof Error ? error.message : String(error);
    console.error(`[db:seed] Error: ${safeMessage}`);
    process.exitCode = 1;
  } finally {
    await disconnectPrisma();
  }
}

void main();
