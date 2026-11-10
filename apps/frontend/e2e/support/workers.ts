const MAX_E2E_WORKERS = 32;

/**
 * Número de workers de Playwright (HU-078, D10). `E2E_WORKERS` manda; sin ella, 2 en local y 1 en el
 * CI (variable `CI`). Cada worker tiene su base de datos y su propio backend y frontend.
 */
export function resolveE2EWorkers(env: Record<string, string | undefined> = process.env): number {
  const raw = env['E2E_WORKERS'];
  if (raw !== undefined && raw.trim() !== '') {
    const parsed = Number(raw);
    if (!/^[0-9]+$/.test(raw.trim()) || parsed < 1 || parsed > MAX_E2E_WORKERS) {
      throw new Error(
        `E2E_WORKERS debe ser un entero entre 1 y ${MAX_E2E_WORKERS} (recibido: '${raw}').`,
      );
    }
    return parsed;
  }
  return env['CI'] ? 1 : 2;
}
