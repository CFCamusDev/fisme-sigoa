import { test, expect } from './support/test';
import { expectNoContrastViolations } from './support/contrast';
import { seedPendingUser } from './support/seed-user';

test.describe('HU-004 — Activar cuenta E2E', () => {
  test.setTimeout(30_000);

  test('user activates the account and then signs in (CA1)', async ({ page }) => {
    const { email, token } = seedPendingUser({});
    const newPassword = 'NewStrongPassword123*';

    await page.goto(`/activar/${token}`);

    await expect(page.getByRole('heading', { name: /activar tu cuenta/i })).toBeVisible();
    await expect(
      page.getByText(/define tu contraseña para activar tu acceso al sistema/i),
    ).toBeVisible();

    await page.getByLabel(/nueva contraseña/i).fill(newPassword);
    await page.getByLabel(/confirmar contraseña/i).fill(newPassword);

    const [response] = await Promise.all([
      page.waitForResponse('**/auth/activate'),
      page.getByRole('button', { name: /activar cuenta/i }).click(),
    ]);

    expect(response.status()).toBe(200);

    // Estado final de éxito
    const successHeading = page.getByRole('heading', { name: /cuenta activada/i });
    await expect(successHeading).toBeVisible();
    await expect(successHeading).toBeFocused();

    await expect(
      page.getByText(/tu cuenta está activa\. ya puedes iniciar sesión\./i),
    ).toBeVisible();

    // Navegar a /login
    await page.getByRole('link', { name: /ir a iniciar sesión/i }).click();
    await expect(page).toHaveURL('/login');

    // Iniciar sesión con las credenciales recién configuradas
    await page.getByLabel(/correo electrónico/i).fill(email);
    await page.getByLabel(/contraseña/i).fill(newPassword);
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    // Redirección exitosa al dashboard institucional
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'FISME-SIGOA' })).toBeVisible();
  });

  test('a used link shows the invalid link state (CA2)', async ({ page }) => {
    const { token } = seedPendingUser({ used: true });

    await page.goto(`/activar/${token}`);

    await page.getByLabel(/nueva contraseña/i).fill('StrongPassword123*');
    await page.getByLabel(/confirmar contraseña/i).fill('StrongPassword123*');

    const [response] = await Promise.all([
      page.waitForResponse('**/auth/activate'),
      page.getByRole('button', { name: /activar cuenta/i }).click(),
    ]);

    expect(response.status()).toBe(400);

    const invalidHeading = page.getByRole('heading', {
      name: /el enlace no es válido o venció\./i,
    });
    await expect(invalidHeading).toBeVisible();
    await expect(invalidHeading).toBeFocused();

    await expect(
      page.getByText(/solicita uno nuevo al administrador del sistema\./i),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /ir a iniciar sesión/i })).toBeVisible();
  });

  test('an expired link shows the invalid link state (CA2)', async ({ page }) => {
    const pastDate = new Date(Date.now() - 3600 * 1000);
    const { token } = seedPendingUser({ expiresAt: pastDate });

    await page.goto(`/activar/${token}`);

    await page.getByLabel(/nueva contraseña/i).fill('StrongPassword123*');
    await page.getByLabel(/confirmar contraseña/i).fill('StrongPassword123*');

    const [response] = await Promise.all([
      page.waitForResponse('**/auth/activate'),
      page.getByRole('button', { name: /activar cuenta/i }).click(),
    ]);

    expect(response.status()).toBe(400);

    const invalidHeading = page.getByRole('heading', {
      name: /el enlace no es válido o venció\./i,
    });
    await expect(invalidHeading).toBeVisible();
    await expect(invalidHeading).toBeFocused();

    await expect(
      page.getByText(/solicita uno nuevo al administrador del sistema\./i),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /ir a iniciar sesión/i })).toBeVisible();
  });

  test('a weak password shows the policy details and sends no request (CA3)', async ({ page }) => {
    const { token } = seedPendingUser({});
    let requestsCount = 0;

    page.on('request', (req) => {
      if (req.url().includes('/auth/activate')) {
        requestsCount++;
      }
    });

    await page.goto(`/activar/${token}`);

    await page.getByLabel(/nueva contraseña/i).fill('abc');
    await page.getByLabel(/confirmar contraseña/i).fill('abc');

    await page.getByRole('button', { name: /activar cuenta/i }).click();

    await expect(page.getByText(/la contraseña debe tener al menos 10 caracteres/i)).toBeVisible();
    await expect(page.getByText(/la contraseña debe incluir al menos un número/i)).toBeVisible();

    expect(requestsCount).toBe(0);
  });

  test('activation form has no contrast violations on desktop and mobile', async ({ page }) => {
    const { token } = seedPendingUser({});

    // Desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/activar/${token}`);
    await expect(page.getByRole('heading', { name: /activar tu cuenta/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'activation-form-desktop' });

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { context: 'activation-form-mobile' });
  });

  test('activation policy errors have no contrast violations', async ({ page }) => {
    const { token } = seedPendingUser({});

    await page.goto(`/activar/${token}`);
    await page.getByLabel(/nueva contraseña/i).fill('weak');
    await page.getByLabel(/confirmar contraseña/i).fill('weak');
    await page.getByRole('button', { name: /activar cuenta/i }).click();

    await expect(page.getByText(/la contraseña debe tener al menos 10 caracteres/i)).toBeVisible();
    await expectNoContrastViolations(page, { context: 'activation-policy-errors' });
  });

  test('activation invalid link state has no contrast violations', async ({ page }) => {
    const { token } = seedPendingUser({ used: true });

    await page.goto(`/activar/${token}`);
    await page.getByLabel(/nueva contraseña/i).fill('StrongPassword123*');
    await page.getByLabel(/confirmar contraseña/i).fill('StrongPassword123*');

    await Promise.all([
      page.waitForResponse('**/auth/activate'),
      page.getByRole('button', { name: /activar cuenta/i }).click(),
    ]);

    await expect(
      page.getByRole('heading', { name: /el enlace no es válido o venció\./i }),
    ).toBeVisible();
    await expectNoContrastViolations(page, { context: 'activation-invalid-link' });
  });

  test('activation success state has no contrast violations', async ({ page }) => {
    const { token } = seedPendingUser({});

    await page.goto(`/activar/${token}`);
    await page.getByLabel(/nueva contraseña/i).fill('StrongPassword123*');
    await page.getByLabel(/confirmar contraseña/i).fill('StrongPassword123*');

    await Promise.all([
      page.waitForResponse('**/auth/activate'),
      page.getByRole('button', { name: /activar cuenta/i }).click(),
    ]);

    await expect(page.getByRole('heading', { name: /cuenta activada/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'activation-success' });
  });
});
