import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from './support/test';
import { seedUser } from './support/seed-user';

/**
 * Aislamiento de los workers de E2E (HU-078, T-078-20, CA8). Con 2 o más workers, estas dos pruebas
 * corren a la vez, cada una en su worker: siembran un usuario propio, se esperan en una barrera y
 * comprueban que su pila (puertos y base de datos) es distinta y que no ven los datos de la otra.
 * Con 1 worker (CI) corren una tras otra y solo comprueban su propia pila.
 */
test.describe.configure({ mode: 'parallel' });

interface Marker {
  apiUrl: string;
  databaseName: string;
  surname: string;
}

const MARKER_DIR = path.join(
  os.tmpdir(),
  `sigoa-e2e-isolation-${process.env['E2E_RUN_ID'] ?? 'local'}`,
);
const BARRIER_TIMEOUT_MS = 60_000;

function databaseNameOf(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

function countUsersWithSurname(surname: string): number {
  const script = [
    "import { createPrismaClient } from './src/shared/prisma/prisma-client.ts';",
    'async function run() {',
    '  const { prisma, disconnect } = createPrismaClient(process.env.TEST_DATABASE_URL!);',
    '  try {',
    '    const count = await prisma.user.count({ where: { firstSurname: process.env.EXPECTED_SURNAME } });',
    '    console.log(JSON.stringify({ count }));',
    '  } finally {',
    '    await disconnect();',
    '  }',
    '}',
    'void run();',
  ].join(' ');

  const output = execSync(`pnpm --filter backend exec tsx -e ${JSON.stringify(script)}`, {
    stdio: 'pipe',
    env: { ...process.env, EXPECTED_SURNAME: surname },
  }).toString('utf-8');
  const last = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') && line.endsWith('}'))
    .at(-1);
  return last ? (JSON.parse(last) as { count: number }).count : -1;
}

async function exchangeMarkers(own: 'a' | 'b', marker: Marker): Promise<Marker | null> {
  fs.mkdirSync(MARKER_DIR, { recursive: true });
  fs.writeFileSync(path.join(MARKER_DIR, `${own}.json`), JSON.stringify(marker));
  const otherFile = path.join(MARKER_DIR, `${own === 'a' ? 'b' : 'a'}.json`);

  await expect
    .poll(() => fs.existsSync(otherFile), { timeout: BARRIER_TIMEOUT_MS, intervals: [250] })
    .toBe(true);
  return JSON.parse(fs.readFileSync(otherFile, 'utf-8')) as Marker;
}

test.describe('Worker isolation', () => {
  test.setTimeout(120_000);

  for (const own of ['a', 'b'] as const) {
    test(`starts one stack per worker and isolates their data (${own})`, async ({
      page,
      workerStack,
    }, testInfo) => {
      const surname = `Aislado${own.toUpperCase()}${Date.now() % 100000}`;
      await seedUser({
        email: `isolation-${own}-${Date.now()}@example.test`,
        names: 'Usuario',
        firstSurname: surname,
        roles: ['TEACHER'],
        status: 'ACTIVE',
      });

      // El fixture fija las variables del worker y la base es una clonada que termina en _test.
      expect(process.env['E2E_API_URL']).toBe(workerStack.apiUrl);
      expect(process.env['DATABASE_URL']).toBe(workerStack.databaseUrl);
      const databaseName = databaseNameOf(workerStack.databaseUrl);
      expect(databaseName).toMatch(/_test$/);
      expect(countUsersWithSurname(surname)).toBe(1);

      const response = await page.request.get(`${workerStack.apiUrl}/health`);
      expect(response.ok()).toBe(true);

      if (testInfo.config.workers < 2) return;

      const other = await exchangeMarkers(own, {
        apiUrl: workerStack.apiUrl,
        databaseName,
        surname,
      });
      expect(other).not.toBeNull();

      // Pilas distintas: otro puerto de backend y otra base de datos.
      expect(other!.apiUrl).not.toBe(workerStack.apiUrl);
      expect(other!.databaseName).not.toBe(databaseName);
      // Ninguna prueba ve datos de otro worker.
      expect(countUsersWithSurname(other!.surname)).toBe(0);
      expect(countUsersWithSurname(surname)).toBe(1);
    });
  }

  test('serves the correct api url to each worker', async ({ page, workerStack }) => {
    await page.goto('/login');
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/auth/')) requests.push(request.url());
    });
    await page.getByLabel(/correo electrónico/i).fill('nadie@example.test');
    await page.getByLabel(/contraseña/i).fill('Password123!');
    await Promise.all([
      page.waitForResponse((res) => res.url().startsWith(workerStack.apiUrl)),
      page.getByRole('button', { name: /acceder al sistema/i }).click(),
    ]);

    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((url) => url.startsWith(workerStack.apiUrl))).toBe(true);
    expect(page.url().startsWith(workerStack.webUrl)).toBe(true);
  });
});
