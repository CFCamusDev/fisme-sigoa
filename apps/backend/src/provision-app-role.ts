import pg from 'pg';
import { loadAppRoleEnv } from './config/app-role-env.js';
import { parseEnv } from './config/env.js';
import { loadEnvFileIfPresent } from './config/load-env-file.js';
import { createLogger } from './shared/logger/logger.js';
import { provisionAppRole } from './shared/prisma/provision-app-role.js';
import { verifyAppRoleRestrictions } from './shared/prisma/verify-app-role.js';

loadEnvFileIfPresent();

/**
 * Ejecuta el aprovisionamiento y verificación integral del rol de base de datos
 * para la aplicación backend (RS-040, RNF-014, RNF-010).
 */
export async function runProvisioningAppRole(
  rawEnv: Record<string, string | undefined> = process.env,
): Promise<{ user: string; action: 'CREATED' | 'UPDATED' }> {
  const appEnv = loadAppRoleEnv(rawEnv);
  const serverEnv = parseEnv(rawEnv);
  const logger = createLogger(serverEnv);

  const adminClient = new pg.Client({ connectionString: appEnv.databaseUrl });
  await adminClient.connect();

  let provisionResult: { user: string; action: 'CREATED' | 'UPDATED' };

  try {
    provisionResult = await provisionAppRole(adminClient, {
      user: appEnv.appDbUser,
      password: appEnv.appDbPassword,
    });
  } finally {
    await adminClient.end();
  }

  // Verificación conectándose con el login recién creado o actualizado
  const appRoleUrl = new URL(appEnv.databaseUrl);
  appRoleUrl.username = appEnv.appDbUser;
  appRoleUrl.password = appEnv.appDbPassword;

  const appClient = new pg.Client({ connectionString: appRoleUrl.toString() });
  await appClient.connect();

  try {
    await verifyAppRoleRestrictions(appClient);
    logger.info(
      { user: provisionResult.user, action: provisionResult.action },
      'Application database role provisioned and verified successfully',
    );
    return provisionResult;
  } finally {
    await appClient.end();
  }
}

// Punto de entrada CLI autónomo
const isDirectExecution =
  process.argv[1]?.endsWith('provision-app-role.ts') ||
  process.argv[1]?.endsWith('provision-app-role.js');

if (isDirectExecution) {
  runProvisioningAppRole()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      const safeMessage = error instanceof Error ? error.message : String(error);
      console.error(`[db:provision-app-role] Error: ${safeMessage}`);
      process.exit(1);
    });
}
