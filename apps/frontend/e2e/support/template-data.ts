import { runBackendScript } from './catalog-data';

const TEMPLATE_ID = 'e2e-template-1';

/**
 * Deja la base del worker sin plantillas. Usa `TRUNCATE`, que no dispara los triggers que impiden
 * borrar versiones publicadas (RN-007): las pruebas comparten la base de su worker.
 */
export function resetTemplates(): void {
  runBackendScript([
    'await prisma.$executeRawUnsafe(\'TRUNCATE TABLE "template_versions", "templates" CASCADE\');',
  ]);
}

/**
 * Siembra una plantilla ficticia con la versión 1 Publicada y, si `withDraft`, el borrador de la
 * versión 2. No depende del seed global ni usa datos reales.
 */
export function seedTemplate(options: { withDraft?: boolean } = {}): string {
  const versions = [
    '{ number: 1, status: "PUBLISHED", content: "<p>{{program.name}} versión 1</p>", publishedAt: new Date("2026-11-01T10:00:00.000Z"), publishedBy: "SEED", createdBy: "SEED", updatedBy: "SEED" }',
    ...(options.withDraft
      ? [
          '{ number: 2, status: "DRAFT", content: "<p>{{program.name}} borrador de la versión 2</p>", createdBy: "SEED", updatedBy: "SEED" }',
        ]
      : []),
  ];
  runBackendScript([
    `await prisma.template.create({ data: { id: "${TEMPLATE_ID}", code: "FO-E2E", name: "Anexo de prueba", type: "ANNEX", variables: [{ key: "program.name", label: "Nombre del programa" }, { key: "schedule.period", label: "Periodo del cronograma" }], createdBy: "SEED", updatedBy: "SEED", versions: { create: [${versions.join(', ')}] } } });`,
  ]);
  return TEMPLATE_ID;
}
