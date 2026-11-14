import { execSync } from 'node:child_process';

function runBackendScript(statements: string[]): void {
  const testDbUrl =
    process.env['TEST_DATABASE_URL'] ||
    process.env['DATABASE_URL'] ||
    'postgresql://postgres:postgres@localhost:5432/sigoa_test?schema=public';

  const script = [
    "import { createPrismaClient } from './src/shared/prisma/prisma-client.ts';",
    "import { seedCatalogVersionDefaults } from './src/modules/catalog/infrastructure/prisma/seed/catalog-version-seed.ts';",
    'async function run() {',
    '  const { prisma, disconnect } = createPrismaClient(process.env.TEST_DATABASE_URL!);',
    '  try {',
    ...statements.map((statement) => `    ${statement}`),
    '  } finally {',
    '    await disconnect();',
    '  }',
    '}',
    'void run();',
  ].join(' ');

  execSync(`pnpm --filter backend exec tsx -e ${JSON.stringify(script)}`, {
    stdio: 'pipe',
    env: { ...process.env, TEST_DATABASE_URL: testDbUrl, DATABASE_URL: testDbUrl },
  });
}

/**
 * Deja la base del worker sin versiones del catálogo. Las pruebas comparten la base de su worker:
 * quien siembra catálogo lo limpia al terminar para no alterar el estado vacío que otras esperan.
 */
export function resetCatalog(): void {
  runBackendScript([
    'await prisma.resolution.deleteMany();',
    'await prisma.storedFile.deleteMany({ where: { publicId: { startsWith: "resolutions/" } } });',
    'await prisma.educationalObjective.deleteMany();',
    'await prisma.graduateAttribute.deleteMany();',
    'await prisma.catalogVersion.deleteMany({ where: { basedOnVersionId: { not: null } } });',
    'await prisma.catalogVersion.deleteMany();',
  ]);
}

/** Siembra la versión 1 vigente (4 OE y 12 AG oficiales) en el programa que ya existe. */
export function seedCurrentCatalog(): void {
  runBackendScript(['await seedCatalogVersionDefaults(prisma);']);
}

/**
 * Siembra la versión 2 En validación (copia de la vigente, sin textos propios) sobre la versión 1
 * vigente: es a la que se puede vincular una resolución (HU-048, RS 5.3). Exige `seedCurrentCatalog`.
 */
export function seedInValidationCatalogVersion(): void {
  runBackendScript([
    'const program = await prisma.program.findFirstOrThrow({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });',
    'const current = await prisma.catalogVersion.findFirstOrThrow({ where: { programId: program.id, status: "APPROVED" } });',
    'await prisma.catalogVersion.create({ data: { programId: program.id, number: 2, status: "IN_VALIDATION", basedOnVersionId: current.id, createdBy: "SEED", updatedBy: "SEED" } });',
  ]);
}

/** Deja la base del worker sin resoluciones ni sus PDF (no toca el catálogo). */
export function resetResolutions(): void {
  runBackendScript([
    'await prisma.resolution.deleteMany();',
    'await prisma.storedFile.deleteMany({ where: { publicId: { startsWith: "resolutions/" } } });',
  ]);
}

/** Siembra una resolución de OE para la versión En validación, Registrada o Aprobada con su PDF. */
export function seedResolution(options: {
  number: string;
  status: 'REGISTERED' | 'APPROVED';
}): void {
  const approved = options.status === 'APPROVED';
  runBackendScript([
    'const version = await prisma.catalogVersion.findFirstOrThrow({ where: { status: "IN_VALIDATION" } });',
    approved
      ? 'const file = await prisma.storedFile.create({ data: { provider: "memory", publicId: "resolutions/e2e-seed", url: "memory://resolutions/e2e-seed", mimeType: "application/pdf", sizeBytes: 64, sha256: "e".repeat(64) } });'
      : 'const file = null;',
    `await prisma.resolution.create({ data: { type: "EDUCATIONAL_OBJECTIVE", number: ${JSON.stringify(options.number)}, issuedOn: new Date("2026-11-10T00:00:00.000Z"), catalogVersionId: version.id, createdBy: "SEED", ...(file ? { status: "APPROVED", pdfFileId: file.id, approvedAt: new Date("2026-11-14T09:00:00.000Z"), approvedBy: "SEED" } : {}) } });`,
  ]);
}
