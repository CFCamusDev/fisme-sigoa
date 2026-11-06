import { test, expect } from '@playwright/test';
import { expectNoContrastViolations } from './support/contrast';
import { seedRecoveryUser, loginAsTestUser, seedUser } from './support/seed-user';

test.describe('HU-005 — Recuperar contraseña E2E', () => {
  test.setTimeout(30_000);

  test('user recovers the password, signs in with the new one and the old session is revoked (CA1, CA2)', async ({
    browser,
  }) => {
    const initialPassword = 'InitialPassword123*';
    const newPassword = 'NewStrongPassword123*';

    // 1. Contexto A: El usuario inicia sesión normalmente
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const { email } = await loginAsTestUser(pageA, { password: initialPassword });

    // 2. Contexto B: El usuario solicita recuperación de contraseña
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await pageB.goto('/recuperar-contrasena');
    await expect(pageB.getByRole('heading', { name: /¿olvidaste tu contraseña\?/i })).toBeVisible();

    await pageB.getByLabel(/correo electrónico/i).fill(email);

    const [forgotResponse] = await Promise.all([
      pageB.waitForResponse('**/auth/forgot-password'),
      pageB.getByRole('button', { name: /enviar enlace/i }).click(),
    ]);
    expect(forgotResponse.status()).toBe(202);

    // Verificación de CA1: Confirmación genérica indistinguible
    const checkEmailHeading = pageB.getByRole('heading', { name: /revisa tu correo/i });
    await expect(checkEmailHeading).toBeVisible();
    await expect(checkEmailHeading).toBeFocused();

    // 3. Sembramos un token conocido en BD para este usuario (D7)
    const resetToken = `e2e-reset-token-${Date.now()}-1234567890abcdef1234567890`;
    seedUser({
      email,
      password: initialPassword,
      status: 'ACTIVE',
      activationToken: {
        token: resetToken,
      },
    });

    // 4. Navegamos al enlace de restablecimiento con el token conocido
    await pageB.goto(`/restablecer/${resetToken}`);
    await expect(pageB.getByRole('heading', { name: /restablecer tu contraseña/i })).toBeVisible();

    await pageB.getByLabel(/^nueva contraseña/i).fill(newPassword);
    await pageB.getByLabel(/^confirmar contraseña/i).fill(newPassword);

    const [resetResponse] = await Promise.all([
      pageB.waitForResponse('**/auth/reset-password'),
      pageB.getByRole('button', { name: /restablecer contraseña/i }).click(),
    ]);
    expect(resetResponse.status()).toBe(200);

    // Estado final de éxito
    const successHeading = pageB.getByRole('heading', {
      level: 1,
      name: /contraseña actualizada/i,
    });
    await expect(successHeading).toBeVisible();
    await expect(successHeading).toBeFocused();
    await expect(
      pageB.getByText(
        /tu contraseña se actualizó y cerramos tus sesiones abiertas\. inicia sesión con la nueva contraseña\./i,
      ),
    ).toBeVisible();

    // 5. Iniciar sesión con la nueva contraseña en Contexto B
    await pageB.getByRole('link', { name: /ir a iniciar sesión/i }).click();
    await expect(pageB).toHaveURL('/login');

    await pageB.getByLabel(/correo electrónico/i).fill(email);
    await pageB.getByLabel(/contraseña/i).fill(newPassword);
    await pageB.getByRole('button', { name: /acceder al sistema/i }).click();

    await expect(pageB).toHaveURL('/');
    await expect(pageB.getByRole('heading', { name: 'FISME-SIGOA' })).toBeVisible();

    // 6. Verificar que la sesión previa en Contexto A quedó revocada (CA2, RS-016)
    await pageA.reload();
    await expect(pageA).toHaveURL('/login');

    await contextA.close();
    await contextB.close();
  });

  test('shows the same confirmation for an unknown email (CA1)', async ({ page }) => {
    await page.goto('/recuperar-contrasena');

    await page.getByLabel(/correo electrónico/i).fill('no-existe-cuenta@untrm.edu.pe');

    const [response] = await Promise.all([
      page.waitForResponse('**/auth/forgot-password'),
      page.getByRole('button', { name: /enviar enlace/i }).click(),
    ]);

    expect(response.status()).toBe(202);

    const heading = page.getByRole('heading', { name: /revisa tu correo/i });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();

    await expect(
      page.getByText(/si el correo existe, recibirás un enlace para restablecer tu contraseña\./i),
    ).toBeVisible();
  });

  test('a used or expired link shows the invalid link state', async ({ page }) => {
    const { token } = seedRecoveryUser({ used: true });

    await page.goto(`/restablecer/${token}`);

    await page.getByLabel(/^nueva contraseña/i).fill('StrongPassword123*');
    await page.getByLabel(/^confirmar contraseña/i).fill('StrongPassword123*');

    const [response] = await Promise.all([
      page.waitForResponse('**/auth/reset-password'),
      page.getByRole('button', { name: /restablecer contraseña/i }).click(),
    ]);

    expect(response.status()).toBe(400);

    const invalidHeading = page.getByRole('heading', {
      name: /el enlace no es válido o venció\./i,
    });
    await expect(invalidHeading).toBeVisible();
    await expect(invalidHeading).toBeFocused();

    await expect(
      page.getByText(/solicita uno nuevo desde «¿olvidaste tu contraseña\?»\./i),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /solicitar un enlace nuevo/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /ir a iniciar sesión/i })).toBeVisible();
  });

  test('a weak password shows the policy details and sends no request', async ({ page }) => {
    const { token } = seedRecoveryUser({});
    let requestsCount = 0;

    page.on('request', (req) => {
      if (req.url().includes('/auth/reset-password')) {
        requestsCount++;
      }
    });

    await page.goto(`/restablecer/${token}`);

    await page.getByLabel(/^nueva contraseña/i).fill('abc');
    await page.getByLabel(/^confirmar contraseña/i).fill('abc');

    await page.getByRole('button', { name: /restablecer contraseña/i }).click();

    await expect(page.getByText(/la contraseña debe tener al menos 10 caracteres/i)).toBeVisible();
    await expect(page.getByText(/la contraseña debe incluir al menos un número/i)).toBeVisible();

    expect(requestsCount).toBe(0);
  });

  test('a double click on send sends a single request', async ({ page }) => {
    let requestsCount = 0;

    page.on('request', (req) => {
      if (req.url().includes('/auth/forgot-password')) {
        requestsCount++;
      }
    });

    await page.goto('/recuperar-contrasena');
    await page.getByLabel(/correo electrónico/i).fill('doubleclick@untrm.edu.pe');

    const [response] = await Promise.all([
      page.waitForResponse('**/auth/forgot-password'),
      page.getByRole('button', { name: /enviar enlace/i }).dblclick(),
    ]);

    expect(response.status()).toBe(202);
    expect(requestsCount).toBe(1);
  });

  test('a double click on reset sends a single request', async ({ page }) => {
    const { token } = seedRecoveryUser({});
    let requestsCount = 0;

    page.on('request', (req) => {
      if (req.url().includes('/auth/reset-password')) {
        requestsCount++;
      }
    });

    await page.goto(`/restablecer/${token}`);
    await page.getByLabel(/^nueva contraseña/i).fill('ValidNewPass123*');
    await page.getByLabel(/^confirmar contraseña/i).fill('ValidNewPass123*');

    const [response] = await Promise.all([
      page.waitForResponse('**/auth/reset-password'),
      page.getByRole('button', { name: /restablecer contraseña/i }).dblclick(),
    ]);

    expect(response.status()).toBe(200);
    expect(requestsCount).toBe(1);
  });

  test('password recovery views have no contrast violations', async ({ page }) => {
    // 1. /recuperar-contrasena (escritorio)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/recuperar-contrasena');
    await expect(page.getByRole('heading', { name: /¿olvidaste tu contraseña\?/i })).toBeVisible();
    await expectNoContrastViolations(page, { screen: 'forgot-password-desktop' });

    // 2. /recuperar-contrasena (móvil)
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { screen: 'forgot-password-mobile' });

    // 3. /recuperar-contrasena (error de formato)
    await page.getByLabel(/correo electrónico/i).fill('correo-invalido');
    await page.getByRole('button', { name: /enviar enlace/i }).click();
    await expect(page.getByText(/el formato del correo electrónico es inválido/i)).toBeVisible();
    await expectNoContrastViolations(page, { screen: 'forgot-password-validation-error' });

    // 4. /recuperar-contrasena (confirmación)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByLabel(/correo electrónico/i).fill('usuario@untrm.edu.pe');
    await Promise.all([
      page.waitForResponse('**/auth/forgot-password'),
      page.getByRole('button', { name: /enviar enlace/i }).click(),
    ]);
    await expect(page.getByRole('heading', { name: /revisa tu correo/i })).toBeVisible();
    await expectNoContrastViolations(page, { screen: 'forgot-password-success' });

    // 5. /restablecer/$token (escritorio y móvil)
    const { token } = seedRecoveryUser({});
    await page.goto(`/restablecer/${token}`);
    await expect(page.getByRole('heading', { name: /restablecer tu contraseña/i })).toBeVisible();
    await expectNoContrastViolations(page, { screen: 'reset-password-desktop' });

    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { screen: 'reset-password-mobile' });

    // 6. /restablecer/$token (enlace inválido)
    const { token: usedToken } = seedRecoveryUser({ used: true });
    await page.goto(`/restablecer/${usedToken}`);
    await page.getByLabel(/^nueva contraseña/i).fill('StrongPass123*');
    await page.getByLabel(/^confirmar contraseña/i).fill('StrongPass123*');
    await Promise.all([
      page.waitForResponse('**/auth/reset-password'),
      page.getByRole('button', { name: /restablecer contraseña/i }).click(),
    ]);
    await expect(
      page.getByRole('heading', { name: /el enlace no es válido o venció\./i }),
    ).toBeVisible();
    await expectNoContrastViolations(page, { screen: 'reset-password-invalid-link' });

    // 7. /restablecer/$token (éxito)
    const { token: successToken } = seedRecoveryUser({});
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/restablecer/${successToken}`);
    await page.getByLabel(/^nueva contraseña/i).fill('StrongPass123*');
    await page.getByLabel(/^confirmar contraseña/i).fill('StrongPass123*');
    await Promise.all([
      page.waitForResponse('**/auth/reset-password'),
      page.getByRole('button', { name: /restablecer contraseña/i }).click(),
    ]);
    await expect(
      page.getByRole('heading', { level: 1, name: /contraseña actualizada/i }),
    ).toBeVisible();
    await expectNoContrastViolations(page, { screen: 'reset-password-success' });
  });
});
