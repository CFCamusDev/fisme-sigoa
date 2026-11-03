import { test, expect } from '@playwright/test';
import { expectNoContrastViolations } from './support/contrast';
import { loginAsTestUser } from './support/seed-user';

test.describe('Color Contrast Accessibility (WCAG 2.1 AA)', () => {
  test.setTimeout(30_000);

  test('login has no contrast violations on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'login-desktop' });
  });

  test('login has no contrast violations on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'login-mobile' });
  });

  test('login session expired notice has no contrast violations', async ({ page }) => {
    await page.goto('/login?reason=session-expired');

    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();
    await expect(page.getByRole('status')).toBeVisible();
    await expectNoContrastViolations(page, { context: 'login-session-expired' });
  });

  test('login credentials error has no contrast violations', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/correo electrónico/i).fill('invalid-user@example.test');
    await page.getByLabel(/contraseña/i).fill('WrongPassword123!');
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expectNoContrastViolations(page, { context: 'login-credentials-error' });
  });

  test('authenticated layout has no contrast violations on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAsTestUser(page);

    await expect(page.getByRole('heading', { name: 'FISME-SIGOA' })).toBeVisible();
    await expect(page.getByRole('button', { name: /cerrar sesión/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'authenticated-layout-desktop' });
  });

  test('authenticated layout has no contrast violations on mobile with the menu open', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsTestUser(page);

    const menuToggle = page.getByRole('button', { name: /menú de navegación/i });
    await expect(menuToggle).toBeVisible();

    await menuToggle.click();
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');

    const closeButton = page.getByRole('button', { name: /cerrar barra lateral/i });
    await expect(closeButton).toBeVisible();

    await expectNoContrastViolations(page, {
      context: 'authenticated-layout-mobile-menu-open',
    });
  });
});
