import { test, expect } from './support/test';
import { DESKTOP, MOBILE, expectNoContrastViolations } from './support/contrast';
import { loginAsTestUser } from './support/seed-user';

/**
 * Contraste de color WCAG 2.1 AA para inicio de sesión y layout autenticado (HU-080, T-080-06).
 */
test.describe('Color Contrast Accessibility (WCAG 2.1 AA) — Auth & Layout', () => {
  test.setTimeout(120_000);

  test('login page states have no contrast violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'login-desktop' });

    await page.setViewportSize(MOBILE);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'login-mobile' });

    await page.setViewportSize(DESKTOP);
    await page.goto('/login?reason=session-expired');
    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();
    await expect(page.getByRole('status')).toBeVisible();
    await expectNoContrastViolations(page, { context: 'login-session-expired' });

    await page.goto('/login');
    await page.getByLabel(/correo electrónico/i).fill('invalid-user@example.test');
    await page.getByLabel(/contraseña/i).fill('WrongPassword123!');
    await page.getByRole('button', { name: /acceder al sistema/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expectNoContrastViolations(page, { context: 'login-credentials-error' });
  });

  test('authenticated layout has no contrast violations on desktop and mobile with the menu open', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page);

    await expect(page.getByRole('heading', { name: 'FISME-SIGOA' })).toBeVisible();
    await expect(page.getByRole('button', { name: /menú de usuario/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'authenticated-layout-desktop' });

    await page.setViewportSize(MOBILE);
    const menuToggle = page.getByRole('button', { name: /menú de navegación/i });
    await expect(menuToggle).toBeVisible();
    await menuToggle.click();
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: /cerrar barra lateral/i })).toBeVisible();
    await expectNoContrastViolations(page, {
      context: 'authenticated-layout-mobile-menu-open',
    });
  });

  test('sidebar groups and user menu have no contrast violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page, { roles: ['ADMINISTRATOR'] });

    const adminGroup = page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('button', { name: 'Administración' });
    await adminGroup.click();
    await expect(page.getByRole('link', { name: 'Usuarios' })).toBeVisible();

    await page.getByRole('button', { name: /menú de usuario/i }).click();
    await expect(page.getByRole('menuitem', { name: /cerrar sesión/i })).toBeVisible();

    await expectNoContrastViolations(page, { context: 'sidebar-group-and-user-menu-open' });
  });
});
