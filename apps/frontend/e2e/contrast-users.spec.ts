import { test, expect } from './support/test';
import { DESKTOP, MOBILE, expectNoContrastViolations, waitForApi } from './support/contrast';
import { loginAsTestUser, seedUser } from './support/seed-user';

test.describe('Color Contrast Accessibility (WCAG 2.1 AA) — Users', () => {
  test.setTimeout(120_000);

  test('user routes have no contrast violations', async ({ page }) => {
    const timestamp = Date.now();
    const suffix = timestamp % 10000;
    const targetSurname = `Destino${suffix}`;
    const editSurname = `Objetivo${suffix}`;
    const accessSurname = `Acceso${suffix}`;
    const draftSurname = `Borrador${suffix}`;

    await seedUser({
      email: `contrast-target-${timestamp}@example.test`,
      names: 'Usuario',
      firstSurname: targetSurname,
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });
    await seedUser({
      email: `contrast-edit-target-${timestamp}@example.test`,
      names: 'Editar',
      firstSurname: editSurname,
      secondSurname: 'Prueba',
      dni: String(40000000 + (timestamp % 10000000)),
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });
    await seedUser({
      email: `contrast-target-access-${timestamp}@example.test`,
      names: 'Usuario',
      firstSurname: accessSurname,
      secondSurname: 'Permisos',
      dni: String(50000000 + (timestamp % 10000000)),
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });
    await seedUser({
      email: `contrast-target-access-unsaved-${timestamp}@example.test`,
      names: 'Usuario',
      firstSurname: draftSurname,
      secondSurname: 'Borrador',
      dni: String(60000000 + (timestamp % 10000000)),
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });

    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page, {
      email: `contrast-admin-${timestamp}@example.test`,
      roles: ['ADMINISTRATOR'],
    });

    // Lista de usuarios: escritorio y móvil
    await page.goto('/usuarios');
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'users-list-desktop' });
    await page.setViewportSize(MOBILE);
    await expectNoContrastViolations(page, { context: 'users-list-mobile' });
    await page.setViewportSize(DESKTOP);

    // Confirmación de inactivación
    await expect(page.getByText(`Usuario ${targetSurname}`)).toBeVisible();
    await page
      .getByRole('button', { name: new RegExp(`inactivar a usuario ${targetSurname}`, 'i') })
      .click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expectNoContrastViolations(page, { context: 'users-deactivation-confirmation' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    // Lista vacía filtrada
    await page.goto('/usuarios?status=INACTIVE');
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'users-list-empty-filtered' });

    // Formulario de alta: vacío (escritorio y móvil) y con errores
    await page.goto('/usuarios/nuevo');
    await expect(page.getByRole('heading', { level: 1, name: 'Nuevo usuario' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'create-user-empty-desktop' });
    await page.setViewportSize(MOBILE);
    await expectNoContrastViolations(page, { context: 'create-user-empty-mobile' });
    await page.setViewportSize(DESKTOP);
    await page.getByRole('button', { name: /crear usuario/i }).click();
    await expect(page.getByText('Los nombres son obligatorios')).toBeVisible();
    await expectNoContrastViolations(page, { context: 'create-user-with-errors' });

    // Formulario de edición
    await page.goto('/usuarios');
    await expect(page.getByText(`Editar ${editSurname} Prueba`)).toBeVisible();
    await page
      .getByRole('link', { name: new RegExp(`editar a editar ${editSurname}`, 'i') })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: /editar usuario/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'edit-user-form' });

    // Panel de accesos: escritorio y móvil
    await page.goto('/usuarios');
    await expect(page.getByText(`Usuario ${accessSurname} Permisos`)).toBeVisible();
    await waitForApi(page, '/effective-permissions', () =>
      page
        .getByRole('link', { name: new RegExp(`editar a usuario ${accessSurname}`, 'i') })
        .click(),
    );
    await page.getByRole('tab', { name: 'Roles' }).click();
    await expect(page.getByRole('heading', { name: 'Roles asignados' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'user-access-panel-desktop' });
    await page.setViewportSize(MOBILE);
    await expectNoContrastViolations(page, { context: 'user-access-panel-mobile' });
    await page.setViewportSize(DESKTOP);

    // Panel de accesos con cambios sin guardar (al final: navegar fuera pediría confirmación)
    await page.goto('/usuarios');
    await expect(page.getByText(`Usuario ${draftSurname} Borrador`)).toBeVisible();
    await waitForApi(page, '/effective-permissions', () =>
      page.getByRole('link', { name: new RegExp(`editar a usuario ${draftSurname}`, 'i') }).click(),
    );
    await page.getByRole('tab', { name: 'Roles' }).click();
    await expect(page.getByRole('heading', { name: 'Roles asignados' })).toBeVisible();
    await page.locator('input[type="checkbox"]:not(:checked)').first().click();
    await expect(page.getByText(/cambio sin guardar/i).first()).toBeVisible();
    await expectNoContrastViolations(page, { context: 'user-access-panel-unsaved-changes' });
  });
});
