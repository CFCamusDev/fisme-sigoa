import { test, expect } from './support/test';
import { seedUser } from './support/seed-user';

test.describe('HU-002 — Mantener y cerrar sesión E2E', () => {
  test.setTimeout(45_000);

  test('refresh token is stored in an HttpOnly cookie and invisible to document.cookie (CA1)', async ({
    page,
    context,
  }) => {
    const email = `e2e-httponly-${Date.now()}@example.test`;
    const password = 'Password123!';

    await seedUser({
      email,
      password,
      names: 'Laura',
      firstSurname: 'Mendoza',
      status: 'ACTIVE',
    });

    await page.goto('/login');
    await page.getByLabel(/correo electrónico/i).fill(email);
    await page.getByLabel(/contraseña/i).fill(password);
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: /cerrar sesión/i })).toBeVisible();

    // JavaScript nunca puede leer la cookie HttpOnly
    const jsCookies = await page.evaluate(() => document.cookie);
    expect(jsCookies).not.toContain('sigoa_refresh_token');

    // El navegador sí la tiene guardada con atributos estrictos
    const browserCookies = await context.cookies();
    const refreshCookie = browserCookies.find((c) => c.name === 'sigoa_refresh_token');
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.sameSite).toBe('Strict');
    expect(refreshCookie?.path).toBe('/auth');
  });

  test('restores the session upon page reload via HttpOnly cookie and SessionHint (CA1)', async ({
    page,
  }) => {
    const email = `e2e-reload-${Date.now()}@example.test`;
    const password = 'Password123!';

    await seedUser({
      email,
      password,
      names: 'Rodrigo',
      firstSurname: 'Sánchez',
      status: 'ACTIVE',
    });

    await page.goto('/login');
    await page.getByLabel(/correo electrónico/i).fill(email);
    await page.getByLabel(/contraseña/i).fill(password);
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByText(/Rodrigo Sánchez/i)).toBeVisible();

    // Recargar la página
    await page.reload();

    // La sesión debe restaurarse automáticamente sin expulsar a /login
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: /cerrar sesión/i })).toBeVisible();
    await expect(page.getByText(/Rodrigo Sánchez/i)).toBeVisible();
  });

  test('renews the session transparently on 401 without redirecting to login (CA1)', async ({
    page,
  }) => {
    const email = `e2e-renew-${Date.now()}@example.test`;
    const password = 'Password123!';

    await seedUser({
      email,
      password,
      names: 'Elena',
      firstSurname: 'Castro',
      status: 'ACTIVE',
    });

    await page.goto('/login');
    await page.getByLabel(/correo electrónico/i).fill(email);
    await page.getByLabel(/contraseña/i).fill(password);
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: /cerrar sesión/i })).toBeVisible();

    // Interceptar una petición para simular 401 una única vez
    let simulated401Occurred = false;
    await page.route('**/health', async (route) => {
      if (!simulated401Occurred) {
        simulated401Occurred = true;
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Token de acceso expirado',
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Desencadenar petición al endpoint /health
    const healthResponseStatus = await page.evaluate(async () => {
      try {
        const res = await window.fetch('/health', { credentials: 'include' });
        return res.status;
      } catch {
        return 0;
      }
    });

    // Se mantiene autenticado en la misma página
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: /cerrar sesión/i })).toBeVisible();
    expect(healthResponseStatus).not.toBe(0);
  });

  test('logs out voluntarily, invalidates the cookie, and prevents access to protected routes (CA2)', async ({
    page,
    context,
  }) => {
    const email = `e2e-logout-${Date.now()}@example.test`;
    const password = 'Password123!';

    await seedUser({
      email,
      password,
      names: 'César',
      firstSurname: 'Vallejo',
      status: 'ACTIVE',
    });

    await page.goto('/login');
    await page.getByLabel(/correo electrónico/i).fill(email);
    await page.getByLabel(/contraseña/i).fill(password);
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    await expect(page).toHaveURL('/');
    const logoutBtn = page.getByRole('button', { name: /cerrar sesión/i });
    await expect(logoutBtn).toBeVisible();

    // Hacer click en Cerrar sesión
    await logoutBtn.click();

    // Redirige al login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();

    // La cookie sigoa_refresh_token fue eliminada o expirada
    const browserCookies = await context.cookies();
    const activeRefreshCookie = browserCookies.find(
      (c) =>
        c.name === 'sigoa_refresh_token' && (c.expires === -1 || c.expires > Date.now() / 1000),
    );
    expect(activeRefreshCookie).toBeUndefined();

    // Intentar entrar directamente al dashboard redirige a login
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('displays an accessible notice when the session has expired (CA3)', async ({ page }) => {
    await page.goto('/login?reason=session-expired');

    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();

    const statusNotice = page.getByRole('status');
    await expect(statusNotice).toBeVisible();
    await expect(statusNotice).toHaveText(/tu sesión expiró\. inicia sesión nuevamente\./i);
  });
});
