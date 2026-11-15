import { getWorkerSeeder } from './seeder';

/**
 * Deja la base del worker sin plantillas. Usa `TRUNCATE`, que no dispara los triggers que impiden
 * borrar versiones publicadas (RN-007): las pruebas comparten la base de su worker.
 */
export async function resetTemplates(): Promise<void> {
  await getWorkerSeeder().resetTemplates();
}

/**
 * Siembra una plantilla ficticia con la versión 1 Publicada y, si `withDraft`, el borrador de la
 * versión 2. No depende del seed global ni usa datos reales.
 */
export async function seedTemplate(options: { withDraft?: boolean } = {}): Promise<string> {
  return getWorkerSeeder().seedTemplate(options);
}
