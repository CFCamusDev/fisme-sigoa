import { test, expect } from './support/test';
import { seedUser } from './support/seed-user';
import { expectNoContrastViolations } from './support/contrast';

test.describe('HU-001 — Iniciar sesión E2E', () => {
  test.setTimeout(30_000);

  for (const viewport of [
    { name: 'escritorio', width: 1280, height: 800 },
    { name: 'móvil', width: 375, height: 812 },
  ]) {
    test(`shows the institutional panel on the primary color with readable text (${viewport.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();

      // El panel declara el azul institucional (--primary #1d4570) como fondo propio
      await expect(page.locator('aside')).toHaveCSS('background-color', 'rgb(29, 69, 112)');
      await expectNoContrastViolations(page, { screen: `Login (${viewport.name})` });
    });
  }

  test('logs in and reaches the dashboard (CA1)', async ({ page }) => {
    const email = `e2e-success-${Date.now()}@example.test`;
    const password = 'CorrectPassword123!';

    await seedUser({
      email,
      password,
      names: 'Usuario',
      firstSurname: 'Exitoso',
      status: 'ACTIVE',
    });

    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();

    await page.getByLabel(/correo electrónico/i).fill(email);
    await page.getByLabel(/contraseña/i).fill(password);
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    // Redirección exitosa a la ruta del dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'FISME-SIGOA' })).toBeVisible();
  });

  test('rejects invalid credentials with generic message and clears password (CA2)', async ({
    page,
  }) => {
    const email = `e2e-invalid-${Date.now()}@example.test`;
    const password = 'RealPassword123!';

    await seedUser({
      email,
      password,
      names: 'Usuario',
      firstSurname: 'Invalido',
      status: 'ACTIVE',
    });

    await page.goto('/login');

    await page.getByLabel(/correo electrónico/i).fill(email);
    await page.getByLabel(/contraseña/i).fill('WrongPassword999!');
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(/correo o contraseña incorrectos\./i);

    const passwordInput = page.getByLabel(/contraseña/i);
    await expect(passwordInput).toHaveValue('');
    await expect(passwordInput).toBeFocused();
  });

  test('locks the account after five failed attempts (CA3)', async ({ page }) => {
    const email = `e2e-lockout-${Date.now()}@example.test`;
    const password = 'LockoutPassword123!';

    await seedUser({
      email,
      password,
      names: 'Usuario',
      firstSurname: 'Bloqueado',
      status: 'ACTIVE',
    });

    await page.goto('/login');

    const emailInput = page.getByLabel(/correo electrónico/i);
    const passwordInput = page.getByLabel(/contraseña/i);
    const submitButton = page.getByRole('button', { name: /acceder al sistema/i });

    await emailInput.fill(email);

    // Ejecutar 5 intentos fallidos
    for (let i = 1; i <= 5; i++) {
      await passwordInput.fill(`WrongAttempt${i}!`);
      await submitButton.click();
      await expect(page.getByRole('alert')).toBeVisible();
    }

    // El 6.º intento debe reportar cuenta bloqueada con el tiempo restante
    await passwordInput.fill('AnotherTry!');
    await submitButton.click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(
      /tu cuenta está bloqueada temporalmente por exceso de intentos fallidos\. inténtalo de nuevo en 15 minuto\(s\)\./i,
    );
  });

  test('rejects an inactive account with a clear message (CA4)', async ({ page }) => {
    const email = `e2e-inactive-${Date.now()}@example.test`;
    const password = 'InactivePassword123!';

    await seedUser({
      email,
      password,
      names: 'Usuario',
      firstSurname: 'Inactivo',
      status: 'INACTIVE',
    });

    await page.goto('/login');

    await page.getByLabel(/correo electrónico/i).fill(email);
    await page.getByLabel(/contraseña/i).fill(password);
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(
      /tu cuenta está inactiva\. comunícate con el administrador del sistema\./i,
    );
  });
});
