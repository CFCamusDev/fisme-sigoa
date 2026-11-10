import os from 'node:os';

const MAX_WORKERS = 32;

/**
 * Número de bases de datos por worker (HU-078).
 *
 * `TEST_DB_WORKERS` manda. Sin ella: en el CI (variable `CI`) se mantiene 1 para conservar el
 * comportamiento de siempre; en local es el menor entre 4 y la mitad de los núcleos (mínimo 1).
 */
export function resolveWorkerCount(
  env: NodeJS.ProcessEnv = process.env,
  cpuCount: number = os.availableParallelism(),
): number {
  const raw = env['TEST_DB_WORKERS'];
  if (raw !== undefined && raw.trim() !== '') {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_WORKERS) {
      throw new Error(
        `TEST_DB_WORKERS debe ser un entero entre 1 y ${MAX_WORKERS} (recibido: '${raw}').`,
      );
    }
    return parsed;
  }
  if (env['CI']) return 1;
  return Math.max(1, Math.min(4, Math.floor(cpuCount / 2)));
}

const TEST_SUFFIX = '_test';

function baseName(databaseName: string): string {
  return databaseName.endsWith(TEST_SUFFIX)
    ? databaseName.slice(0, -TEST_SUFFIX.length)
    : databaseName;
}

/** Nombre de la base plantilla derivada de la base de pruebas (`sigoa_test` → `sigoa_tpl_test`). */
export function templateDatabaseName(databaseName: string): string {
  return `${baseName(databaseName)}_tpl${TEST_SUFFIX}`;
}

/** Nombre de la base del worker `index` (`sigoa_test`, 2 → `sigoa_w2_test`). */
export function workerDatabaseName(databaseName: string, index: number): string {
  return `${baseName(databaseName)}_w${index}${TEST_SUFFIX}`;
}

/** Nombre de la base que contiene una URL de conexión. */
export function databaseNameOf(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

/** La misma URL de conexión apuntando a otra base. */
export function withDatabaseName(url: string, databaseName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

/**
 * URL de la base del worker actual. Con un solo worker (o fuera de un worker de Vitest)
 * devuelve la URL recibida sin cambios.
 */
export function resolveWorkerDatabaseUrl(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
  cpuCount?: number,
): string {
  const workers = resolveWorkerCount(env, cpuCount);
  const poolId = Number(env['VITEST_POOL_ID']);
  if (workers > 1 && Number.isInteger(poolId) && poolId >= 1 && poolId <= workers) {
    return withDatabaseName(url, workerDatabaseName(databaseNameOf(url), poolId));
  }
  return url;
}
