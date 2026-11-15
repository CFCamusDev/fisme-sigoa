import { test, expect } from './support/test';
import { DESKTOP, MOBILE, expectNoContrastViolations } from './support/contrast';
import { loginAsTestUser } from './support/seed-user';

test.describe('Color Contrast Accessibility (WCAG 2.1 AA) — Roles', () => {
  test.setTimeout(120_000);

  test('role routes have no contrast violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page, {
      email: `contrast-admin-roles-${Date.now()}@example.test`,
      roles: ['ADMINISTRATOR'],
    });

    // Lista de roles: escritorio y móvil
    await page.goto('/roles');
    await expect(page.getByRole('heading', { level: 1, name: 'Roles' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'roles-list-desktop' });
    await page.setViewportSize(MOBILE);
    await expectNoContrastViolations(page, { context: 'roles-list-mobile' });
    await page.setViewportSize(DESKTOP);

    // Confirmación de desactivación
    const deactivateButton = page.getByRole('button', { name: /desactivar rol/i }).first();
    if (await deactivateButton.isVisible()) {
      await deactivateButton.click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expectNoContrastViolations(page, { context: 'roles-deactivation-alertdialog' });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
    }

    // Formulario de alta: vacío (escritorio y móvil) y con errores
    await page.goto('/roles/nuevo');
    await expect(page.getByRole('heading', { level: 1, name: 'Nuevo rol' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'create-role-empty-desktop' });
    await page.setViewportSize(MOBILE);
    await expectNoContrastViolations(page, { context: 'create-role-empty-mobile' });
    await page.setViewportSize(DESKTOP);
    await page.getByRole('button', { name: /guardar/i }).click();
    await expect(page.getByText('El nombre de rol es requerido')).toBeVisible();
    await expectNoContrastViolations(page, { context: 'create-role-with-errors' });

    // Formulario de edición
    await page.goto('/roles');
    await expect(page.getByRole('heading', { level: 1, name: 'Roles' })).toBeVisible();
    const firstEditButton = page.getByRole('link', { name: /editar rol/i }).first();
    await expect(firstEditButton).toBeVisible();
    await firstEditButton.click();
    await expect(page.getByRole('heading', { level: 1, name: /editar rol:/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'edit-role-form' });

    // Matriz de permisos: escritorio y móvil
    await page.goto('/roles');
    await expect(page.getByRole('heading', { level: 1, name: 'Roles' })).toBeVisible();
    const permissionsLink = page.getByRole('link', { name: /permisos del rol/i }).first();
    await expect(permissionsLink).toBeVisible();
    await permissionsLink.click();
    await expect(page.getByRole('heading', { level: 1, name: /permisos del rol:/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'role-permissions-matrix-desktop' });
    await page.setViewportSize(MOBILE);
    await expectNoContrastViolations(page, { context: 'role-permissions-matrix-mobile' });
    await page.setViewportSize(DESKTOP);

    // Matriz con cambios sin guardar (al final: navegar fuera pediría confirmación)
    const firstSelect = page.getByRole('combobox').first();
    await expect(firstSelect).toBeVisible();
    const currentValue = await firstSelect.inputValue();
    await firstSelect.selectOption(currentValue === 'GLOBAL' ? 'NONE' : 'GLOBAL');
    await expect(page.getByText(/cambio sin guardar/i)).toBeVisible();
    await expectNoContrastViolations(page, { context: 'role-permissions-unsaved-changes' });
  });
});
