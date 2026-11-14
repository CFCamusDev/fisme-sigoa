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

/**
 * Convierte la versión 1 vigente en Histórica y siembra la versión 2 vigente con un OE ampliado y
 * otro quitado, cada una con su resolución de OE aprobada (HU-017). Exige `seedCurrentCatalog`.
 */
export function seedHistoricalCatalog(): void {
  runBackendScript([
    'const program = await prisma.program.findFirstOrThrow({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });',
    'const v1 = await prisma.catalogVersion.findFirstOrThrow({ where: { programId: program.id, status: "APPROVED" }, include: { objectives: true, attributes: true } });',
    'await prisma.catalogVersion.update({ where: { id: v1.id }, data: { status: "HISTORICAL" } });',
    'const v2 = await prisma.catalogVersion.create({ data: { programId: program.id, number: 2, status: "APPROVED", basedOnVersionId: v1.id, createdBy: "SEED", updatedBy: "SEED", objectives: { create: v1.objectives.filter((o) => o.code !== "OEP4").map((o) => ({ code: o.code, statement: o.code === "OEP1" ? o.statement + " Texto ampliado para la comparación." : o.statement, order: o.order })) }, attributes: { create: v1.attributes.map((a) => ({ code: a.code, name: a.name, statement: a.statement, order: a.order })) } } });',
    'const f1 = await prisma.storedFile.create({ data: { provider: "memory", publicId: "resolutions/e2e-history-1", url: "memory://resolutions/e2e-history-1", mimeType: "application/pdf", sizeBytes: 64, sha256: "1".repeat(64) } });',
    'const f2 = await prisma.storedFile.create({ data: { provider: "memory", publicId: "resolutions/e2e-history-2", url: "memory://resolutions/e2e-history-2", mimeType: "application/pdf", sizeBytes: 64, sha256: "2".repeat(64) } });',
    'await prisma.resolution.create({ data: { type: "EDUCATIONAL_OBJECTIVE", number: "E2E-128-2024", issuedOn: new Date("2024-02-20T00:00:00.000Z"), status: "APPROVED", approvedAt: new Date("2024-03-01T10:00:00.000Z"), approvedBy: "SEED", pdfFileId: f1.id, catalogVersionId: v1.id, createdBy: "SEED" } });',
    'await prisma.resolution.create({ data: { type: "EDUCATIONAL_OBJECTIVE", number: "E2E-210-2026", issuedOn: new Date("2026-05-02T00:00:00.000Z"), status: "APPROVED", approvedAt: new Date("2026-05-10T09:00:00.000Z"), approvedBy: "SEED", pdfFileId: f2.id, catalogVersionId: v2.id, createdBy: "SEED" } });',
  ]);
}
