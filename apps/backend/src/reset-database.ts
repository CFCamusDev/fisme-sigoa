import { loadEnv } from './config/env.js';
import { loadEnvFileIfPresent } from './config/load-env-file.js';
import { decideDatabaseReset } from './database-reset/reset-policy.js';
import { runDatabaseReset } from './database-reset/run-database-reset.js';
import { createLogger } from './shared/logger/logger.js';
import { disconnectPrisma, getPrismaClient } from './shared/prisma/prisma-client.js';

loadEnvFileIfPresent();

async function main(): Promise<void> {
  let decision: ReturnType<typeof decideDatabaseReset>;
  try {
    decision = decideDatabaseReset({
      resetOnDeploy: process.env.DB_RESET_ON_DEPLOY,
      resetConfirm: process.env.DB_RESET_CONFIRM,
      databaseUrl: process.env.DATABASE_URL,
      appPublicUrl: process.env.APP_PUBLIC_URL,
    });
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : String(error);
    console.error(`[db:reset] Error: ${safeMessage}`);
    process.exitCode = 1;
    return;
  }

  if (decision.action === 'SKIP') {
    console.log('[db:reset] DB_RESET_ON_DEPLOY desactivado; se omite el reinicio de datos.');
    return;
  }

  const env = loadEnv();
  const logger = createLogger(env);
  const prisma = getPrismaClient(env);

  try {
    await runDatabaseReset({
      prisma,
      rawEnv: process.env,
      logger: {
        info: (message) => {
          logger.info(message);
          console.log(message);
        },
        warn: (message) => {
          logger.warn(message);
          console.warn(message);
        },
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Error executing controlled database reset');
    const safeMessage = error instanceof Error ? error.message : String(error);
    console.error(`[db:reset] Error: ${safeMessage}`);
    process.exitCode = 1;
  } finally {
    await disconnectPrisma();
  }
}

void main();
