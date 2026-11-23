const TEST_ENVIRONMENT_LABELS = new Set([
  'staging',
  'stg',
  'qa',
  'test',
  'dev',
  'sandbox',
  'preview',
]);

export class DatabaseResetRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseResetRefusedError';
  }
}

export interface DecideDatabaseResetInput {
  readonly resetOnDeploy?: string;
  readonly resetConfirm?: string;
  readonly databaseUrl?: string;
  readonly databaseName?: string;
  readonly appPublicUrl?: string;
}

export type DecideDatabaseResetResult =
  { readonly action: 'SKIP' } | { readonly action: 'RESET'; readonly databaseName: string };

/**
 * Extrae el nombre de la base de datos desde `DATABASE_URL` (PostgreSQL).
 */
export function extractDatabaseName(databaseUrl: string | undefined): string {
  const raw = (databaseUrl ?? '').trim();
  if (!raw) {
    throw new DatabaseResetRefusedError(
      'No se pudo determinar el nombre de la base de datos: falta DATABASE_URL.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new DatabaseResetRefusedError(
      'No se pudo determinar el nombre de la base de datos: DATABASE_URL no es válida.',
    );
  }

  const dbName = parsed.pathname.replace(/^\/+/, '').split('/')[0]?.trim() ?? '';
  if (!dbName) {
    throw new DatabaseResetRefusedError(
      'No se pudo determinar el nombre de la base de datos en DATABASE_URL.',
    );
  }

  return dbName;
}

function isAllowedTestEnvironmentUrl(appPublicUrl: string | undefined): boolean {
  const raw = (appPublicUrl ?? '').trim();
  if (!raw) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') {
    return true;
  }

  const labels = host.split('.');
  return labels.some((label) =>
    label.split('-').some((segment) => TEST_ENVIRONMENT_LABELS.has(segment)),
  );
}

/**
 * Evalúa si debe ejecutarse el reinicio controlado de datos en staging/pruebas.
 * Cualquier ambigüedad o entorno no autorizado aborta antes de tocar la base.
 */
export function decideDatabaseReset(input: DecideDatabaseResetInput): DecideDatabaseResetResult {
  const rawFlag = (input.resetOnDeploy ?? '').trim();
  if (rawFlag === '' || rawFlag === 'false') {
    return { action: 'SKIP' };
  }

  if (rawFlag !== 'true') {
    throw new DatabaseResetRefusedError(
      'DB_RESET_ON_DEPLOY debe ser exactamente "true" o "false".',
    );
  }

  const databaseName = input.databaseName?.trim() || extractDatabaseName(input.databaseUrl);
  const confirm = (input.resetConfirm ?? '').trim();
  if (confirm !== databaseName) {
    throw new DatabaseResetRefusedError(
      `DB_RESET_CONFIRM debe coincidir exactamente con el nombre de la base de datos ("${databaseName}").`,
    );
  }

  if (!isAllowedTestEnvironmentUrl(input.appPublicUrl)) {
    throw new DatabaseResetRefusedError(
      'El reinicio de datos solo está permitido en entornos locales o de staging/pruebas según APP_PUBLIC_URL.',
    );
  }

  return { action: 'RESET', databaseName };
}
