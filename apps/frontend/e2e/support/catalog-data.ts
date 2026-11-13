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
