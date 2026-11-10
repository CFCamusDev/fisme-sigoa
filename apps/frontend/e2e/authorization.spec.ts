import { execSync } from 'node:child_process';
import { test, expect } from './support/test';
import { expectNoContrastViolations } from './support/contrast';
import { loginAsTestUser, seedUser } from './support/seed-user';

/** URL del backend del worker actual, fijada por el fixture de e2e/support/test.ts. */
function backendApiUrl(): string {
  const url = process.env['E2E_API_URL'];
  if (!url) throw new Error('Falta E2E_API_URL: la prueba debe usar el test de e2e/support/test.');
  return url;
}

function countAccessDeniedLogsForRoute(route: string): number {
  const testDbUrl =
    process.env['TEST_DATABASE_URL'] ||
    process.env['DATABASE_URL'] ||
    'postgresql://postgres:postgres@localhost:5432/sigoa_test?schema=public';

  const script = [
    "import { createPrismaClient } from './src/shared/prisma/prisma-client.ts';",
    'async function run() {',
    '  const { prisma, disconnect } = createPrismaClient(process.env.TEST_DATABASE_URL!);',
    '  try {',
    "    const logs = await prisma.auditLog.findMany({ where: { action: 'ACCESS_DENIED' }, orderBy: { sequence: 'desc' }, take: 10 });",
    "    const matched = logs.filter((l) => l.after && typeof l.after === 'object' && 'route' in l.after && l.after.route === process.env.EXPECTED_ROUTE);",
    '    console.log(JSON.stringify({ count: matched.length }));',
    '  } finally {',
    '    await disconnect();',
    '  }',
    '}',
    'void run();',
  ].join(' ');

  const out = execSync(`pnpm --filter backend exec tsx -e ${JSON.stringify(script)}`, {
    stdio: 'pipe',
    env: {
      ...process.env,
      TEST_DATABASE_URL: testDbUrl,
      DATABASE_URL: testDbUrl,
      EXPECTED_ROUTE: route,
    },
  }).toString('utf-8');

  const lines = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{') && l.endsWith('}'));
  const last = lines.at(-1);
  return last ? (JSON.parse(last) as { count: number }).count : 0;
}

test.describe('HU-008 — Autorización por permiso y alcance E2E', () => {
  test.setTimeout(60_000);

  test('teacher without user/role permissions sees filtered sidebar, forbidden page on /usuarios and /roles, and 403 on API (CA1, CA3)', async ({
    page,
    request,
  }) => {
    const timestamp = Date.now();
    const teacherEmail = `e2e-docente-hu008-${timestamp}@example.test`;
    const teacherPassword = 'Password123!';

    // 1. Sembrado de Docente (solo tiene permisos OWN de medición directa e indirecta, sin usuario.* ni rol.*)
    seedUser({
      email: teacherEmail,
      password: teacherPassword,
      names: 'Docente',
      firstSurname: 'Autorizacion',
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/login');

    const [permissionsRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/me/permissions') && res.status() === 200),
      (async () => {
        await page.getByLabel(/correo electrónico/i).fill(teacherEmail);
        await page.getByLabel(/contraseña/i).fill(teacherPassword);
        await page.getByRole('button', { name: /acceder al sistema/i }).click();
      })(),
    ]);
    expect(permissionsRes.ok()).toBe(true);

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'FISME-SIGOA' })).toBeVisible();

    // 2. El menú lateral del Docente muestra Panel y oculta Usuarios, Roles, Programa, Semestres y Parámetros (CA3)
    const mainNav = page.getByRole('navigation', { name: 'Navegación principal' });
    await expect(mainNav.getByRole('link', { name: 'Panel' })).toBeVisible();
    await expect(mainNav.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
    await expect(mainNav.getByRole('link', { name: 'Roles' })).toHaveCount(0);
    await expect(mainNav.getByRole('link', { name: 'Programa' })).toHaveCount(0);
    await expect(mainNav.getByRole('link', { name: 'Semestres' })).toHaveCount(0);
    await expect(mainNav.getByRole('link', { name: 'Parámetros' })).toHaveCount(0);

    // Verificar contraste WCAG 2.1 AA en el panel del Docente (escritorio y móvil)
    await expectNoContrastViolations(page, { screen: 'teacher-dashboard-desktop' });
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { screen: 'teacher-dashboard-mobile' });
    await page.setViewportSize({ width: 1280, height: 720 });

    // 3. Navegación directa a /usuarios muestra ForbiddenPage sin cambiar la URL (CA3)
    await page.goto('/usuarios');
    await expect(page).toHaveURL(/\/usuarios/);

    const forbiddenHeading = page.getByRole('heading', {
      level: 1,
      name: 'No tienes acceso a esta sección',
    });
    await expect(forbiddenHeading).toBeVisible();
    await expect(forbiddenHeading).toBeFocused();

    const forbiddenRegion = page.getByRole('region', {
      name: 'No tienes acceso a esta sección',
    });
    await expect(forbiddenRegion).toBeVisible();

    // Verificar contraste WCAG 2.1 AA en ForbiddenPage (escritorio y móvil)
    await expectNoContrastViolations(page, { screen: 'forbidden-page-desktop' });
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { screen: 'forbidden-page-mobile' });
    await page.setViewportSize({ width: 1280, height: 720 });

    // 4. Navegación directa a /roles también muestra ForbiddenPage
    await page.goto('/roles');
    await expect(page).toHaveURL('/roles');
    await expect(
      page.getByRole('heading', { level: 1, name: 'No tienes acceso a esta sección' }),
    ).toBeVisible();

    // 5. Petición directa al API GET /users con el token del Docente responde 403 y audita ACCESS_DENIED (CA1)
    const loginApiRes = await request.post(`${backendApiUrl()}/auth/login`, {
      data: { email: teacherEmail, password: teacherPassword },
    });
    expect(loginApiRes.status()).toBe(200);
    const loginBody = (await loginApiRes.json()) as { accessToken: string };

    const usersApiRes = await request.get(`${backendApiUrl()}/users`, {
      headers: {
        Authorization: `Bearer ${loginBody.accessToken}`,
      },
    });
    expect(usersApiRes.status()).toBe(403);
    const errorBody = (await usersApiRes.json()) as { error: { code: string; message: string } };
    expect(errorBody.error.code).toBe('FORBIDDEN');
    expect(countAccessDeniedLogsForRoute('/users')).toBeGreaterThanOrEqual(1);
  });

  test('administrator sees all menu items and accesses /usuarios and /roles (CA3)', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const adminEmail = `e2e-admin-hu008-${timestamp}@example.test`;

    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    const mainNav = page.getByRole('navigation', { name: 'Navegación principal' });
    await expect(mainNav.getByRole('link', { name: 'Panel' })).toBeVisible();
    await expect(mainNav.getByRole('link', { name: 'Usuarios' })).toBeVisible();
    await expect(mainNav.getByRole('link', { name: 'Roles' })).toBeVisible();
    await expect(mainNav.getByRole('link', { name: 'Programa' })).toBeVisible();
    await expect(mainNav.getByRole('link', { name: 'Semestres' })).toBeVisible();
    await expect(mainNav.getByRole('link', { name: 'Parámetros' })).toBeVisible();

    await mainNav.getByRole('link', { name: 'Semestres' }).click();
    await expect(page).toHaveURL(/\/configuracion\/semestres/);
    await expect(page.getByRole('heading', { level: 1, name: 'Semestres' })).toBeVisible();

    await mainNav.getByRole('link', { name: 'Parámetros' }).click();
    await expect(page).toHaveURL(/\/configuracion\/parametros/);
    await expect(page.getByRole('heading', { level: 1, name: 'Parámetros' })).toBeVisible();

    await mainNav.getByRole('link', { name: 'Programa' }).click();
    await expect(page).toHaveURL(/\/configuracion\/programa/);
    await expect(page.getByRole('heading', { level: 1, name: 'Programa' })).toBeVisible();

    await mainNav.getByRole('link', { name: 'Usuarios' }).click();
    await expect(page).toHaveURL(/\/usuarios/);
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
    await expect(page.getByRole('link', { name: /nuevo usuario/i })).toBeVisible();

    await mainNav.getByRole('link', { name: 'Roles' }).click();
    await expect(page).toHaveURL(/\/roles/);
    await expect(page.getByRole('heading', { level: 1, name: 'Roles' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nuevo rol' })).toBeVisible();
  });
});
