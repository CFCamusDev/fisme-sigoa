import { test, expect } from '@playwright/test';
import { expectNoContrastViolations } from './support/contrast';
import { loginAsTestUser, seedUser } from './support/seed-user';

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

  test('users list has no contrast violations on desktop and mobile', async ({ page }) => {
    const adminEmail = `contrast-admin-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    // 1. Escritorio (1280px)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/usuarios');
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'users-list-desktop' });

    // 2. Móvil (375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { context: 'users-list-mobile' });
  });

  test('deactivation confirmation has no contrast violations', async ({ page }) => {
    const timestamp = Date.now();
    const adminEmail = `contrast-admin-deact-${timestamp}@example.test`;
    const targetEmail = `contrast-target-${timestamp}@example.test`;

    const uniqueName = `Destino${timestamp % 10000}`;

    seedUser({
      email: targetEmail,
      names: 'Usuario',
      firstSurname: uniqueName,
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });

    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    await page.goto('/usuarios');
    await expect(page.getByText(`Usuario ${uniqueName}`)).toBeVisible();

    const deactivateBtn = page.getByRole('button', {
      name: new RegExp(`inactivar a usuario ${uniqueName}`, 'i'),
    });
    await deactivateBtn.click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();

    await expectNoContrastViolations(page, { context: 'users-deactivation-confirmation' });
  });

  test('empty filtered list has no contrast violations', async ({ page }) => {
    const adminEmail = `contrast-admin-empty-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    await page.goto('/usuarios?status=INACTIVE');
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'users-list-empty-filtered' });
  });

  test('create user form has no contrast violations (empty and with errors)', async ({ page }) => {
    const adminEmail = `contrast-admin-create-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/usuarios/nuevo');
    await expect(page.getByRole('heading', { level: 1, name: 'Nuevo usuario' })).toBeVisible();

    // 1. Formulario vacío en escritorio
    await expectNoContrastViolations(page, { context: 'create-user-empty-desktop' });

    // 2. Formulario vacío en móvil
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { context: 'create-user-empty-mobile' });

    // 3. Formulario con errores de validación
    await page.getByRole('button', { name: /crear usuario/i }).click();
    await expect(page.getByText('Los nombres son obligatorios')).toBeVisible();
    await expectNoContrastViolations(page, { context: 'create-user-with-errors' });
  });

  test('edit user form has no contrast violations', async ({ page }) => {
    const timestamp = Date.now();
    const adminEmail = `contrast-admin-edit-${timestamp}@example.test`;
    const targetEmail = `contrast-edit-target-${timestamp}@example.test`;

    const uniqueEditSurname = `Objetivo${timestamp % 10000}`;

    seedUser({
      email: targetEmail,
      names: 'Editar',
      firstSurname: uniqueEditSurname,
      secondSurname: 'Prueba',
      dni: String(40000000 + (timestamp % 10000000)),
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });

    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    await page.goto('/usuarios');
    await expect(page.getByText(`Editar ${uniqueEditSurname} Prueba`)).toBeVisible();

    const editLink = page.getByRole('link', {
      name: new RegExp(`editar a editar ${uniqueEditSurname}`, 'i'),
    });
    await editLink.click();

    await expect(page.getByRole('heading', { level: 1, name: /editar usuario/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'edit-user-form' });
  });

  test('user access panel has no contrast violations on desktop and mobile (HU-007, T-007-27)', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const adminEmail = `contrast-admin-access-${timestamp}@example.test`;
    const targetEmail = `contrast-target-access-${timestamp}@example.test`;
    const uniqueSurname = `Acceso${timestamp % 10000}`;

    seedUser({
      email: targetEmail,
      names: 'Usuario',
      firstSurname: uniqueSurname,
      secondSurname: 'Permisos',
      dni: String(50000000 + (timestamp % 10000000)),
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });

    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/usuarios');
    await expect(page.getByText(`Usuario ${uniqueSurname} Permisos`)).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/effective-permissions') && res.status() === 200,
      ),
      page
        .getByRole('link', {
          name: new RegExp(`editar a usuario ${uniqueSurname}`, 'i'),
        })
        .click(),
    ]);
    expect(response.ok()).toBe(true);

    await expect(page.getByRole('heading', { name: 'Roles asignados' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Permisos directos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Permisos efectivos' })).toBeVisible();

    // 1. Escritorio (1280px)
    await expectNoContrastViolations(page, { context: 'user-access-panel-desktop' });

    // 2. Móvil (375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { context: 'user-access-panel-mobile' });
  });

  test('user access panel with unsaved changes has no contrast violations (HU-007, T-007-27)', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const adminEmail = `contrast-admin-access-unsaved-${timestamp}@example.test`;
    const targetEmail = `contrast-target-access-unsaved-${timestamp}@example.test`;
    const uniqueSurname = `Borrador${timestamp % 10000}`;

    seedUser({
      email: targetEmail,
      names: 'Usuario',
      firstSurname: uniqueSurname,
      secondSurname: 'Borrador',
      dni: String(60000000 + (timestamp % 10000000)),
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });

    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/usuarios');
    await expect(page.getByText(`Usuario ${uniqueSurname} Borrador`)).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/effective-permissions') && res.status() === 200,
      ),
      page
        .getByRole('link', {
          name: new RegExp(`editar a usuario ${uniqueSurname}`, 'i'),
        })
        .click(),
    ]);
    expect(response.ok()).toBe(true);

    await expect(page.getByRole('heading', { name: 'Roles asignados' })).toBeVisible();

    // Modificar un checkbox no seleccionado para crear un borrador
    const uncheckedCheckbox = page.locator('input[type="checkbox"]:not(:checked)').first();
    await uncheckedCheckbox.click();

    const unsavedNotice = page.getByText(/cambio sin guardar/i).first();
    await expect(unsavedNotice).toBeVisible();

    await expectNoContrastViolations(page, { context: 'user-access-panel-unsaved-changes' });
  });

  test('roles list has no contrast violations on desktop and mobile', async ({ page }) => {
    const adminEmail = `contrast-admin-roles-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    // 1. Escritorio (1280px)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/roles');
    await expect(page.getByRole('heading', { level: 1, name: 'Roles' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'roles-list-desktop' });

    // 2. Móvil (375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { context: 'roles-list-mobile' });
  });

  test('create role form has no contrast violations (empty and with errors)', async ({ page }) => {
    const adminEmail = `contrast-admin-create-role-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/roles/nuevo');
    await expect(page.getByRole('heading', { level: 1, name: 'Nuevo rol' })).toBeVisible();

    // 1. Formulario vacío en escritorio
    await expectNoContrastViolations(page, { context: 'create-role-empty-desktop' });

    // 2. Formulario vacío en móvil
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { context: 'create-role-empty-mobile' });

    // 3. Formulario con errores de validación
    await page.getByRole('button', { name: /guardar/i }).click();
    await expect(page.getByText('El nombre de rol es requerido')).toBeVisible();
    await expectNoContrastViolations(page, { context: 'create-role-with-errors' });
  });

  test('edit role form has no contrast violations', async ({ page }) => {
    const adminEmail = `contrast-admin-edit-role-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    await page.goto('/roles');
    await expect(page.getByRole('heading', { level: 1, name: 'Roles' })).toBeVisible();

    // Clic en la primera acción de edición disponible
    const firstEditButton = page.getByRole('link', { name: /editar rol/i }).first();
    await expect(firstEditButton).toBeVisible();
    await firstEditButton.click();

    await expect(page.getByRole('heading', { level: 1, name: /editar rol:/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'edit-role-form' });
  });

  test('role permissions matrix has no contrast violations on desktop and mobile', async ({
    page,
  }) => {
    const adminEmail = `contrast-admin-perm-matrix-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/roles');
    await expect(page.getByRole('heading', { level: 1, name: 'Roles' })).toBeVisible();

    const permissionsLink = page.getByRole('link', { name: /permisos del rol/i }).first();
    await expect(permissionsLink).toBeVisible();
    await permissionsLink.click();

    await expect(page.getByRole('heading', { level: 1, name: /permisos del rol:/i })).toBeVisible();

    // 1. Escritorio (1280px)
    await expectNoContrastViolations(page, { context: 'role-permissions-matrix-desktop' });

    // 2. Móvil (375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { context: 'role-permissions-matrix-mobile' });
  });

  test('role permissions matrix with unsaved changes has no contrast violations', async ({
    page,
  }) => {
    const adminEmail = `contrast-admin-unsaved-matrix-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/roles');
    await expect(page.getByRole('heading', { level: 1, name: 'Roles' })).toBeVisible();

    const permissionsLink = page.getByRole('link', { name: /permisos del rol/i }).first();
    await expect(permissionsLink).toBeVisible();
    await permissionsLink.click();

    await expect(page.getByRole('heading', { level: 1, name: /permisos del rol:/i })).toBeVisible();

    // Modificar el primer select interactivo disponible
    const firstSelect = page.getByRole('combobox').first();
    await expect(firstSelect).toBeVisible();

    const currentValue = await firstSelect.inputValue();
    const targetValue = currentValue === 'GLOBAL' ? 'NONE' : 'GLOBAL';
    await firstSelect.selectOption(targetValue);

    const unsavedNotice = page.getByText(/cambio sin guardar/i);
    await expect(unsavedNotice).toBeVisible();

    await expectNoContrastViolations(page, { context: 'role-permissions-unsaved-changes' });
  });

  test('roles list with deactivation confirmation alertdialog has no contrast violations', async ({
    page,
  }) => {
    const adminEmail = `contrast-admin-role-deact-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/roles');
    await expect(page.getByRole('heading', { level: 1, name: 'Roles' })).toBeVisible();

    const deactivateButton = page.getByRole('button', { name: /desactivar rol/i }).first();
    if (await deactivateButton.isVisible()) {
      await deactivateButton.click();
      const alertDialog = page.getByRole('alertdialog');
      await expect(alertDialog).toBeVisible();
      await expectNoContrastViolations(page, { context: 'roles-deactivation-alertdialog' });
    }
  });

  test('program configuration page has no contrast violations in editable mode (HU-009, T-009-12)', async ({
    page,
  }) => {
    const adminEmail = `contrast-admin-prog-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    const [progRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/program') && res.status() === 200),
      page.goto('/configuracion/programa'),
    ]);
    expect(progRes.ok()).toBe(true);

    await expect(page.getByRole('heading', { level: 1, name: 'Programa' })).toBeVisible();
    await expect(page.getByRole('button', { name: /guardar cambios/i })).toBeVisible();

    // 1. Escritorio
    await expectNoContrastViolations(page, { context: 'program-config-editable-desktop' });

    // 2. Móvil
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { context: 'program-config-editable-mobile' });
  });

  test('program configuration page has no contrast violations in read-only mode (HU-009, T-009-12)', async ({
    page,
  }) => {
    const committeeEmail = `contrast-committee-prog-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: committeeEmail,
      roles: ['COMMITTEE_MEMBER'],
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    const [progResReadonly] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/program') && res.status() === 200),
      page.goto('/configuracion/programa'),
    ]);
    expect(progResReadonly.ok()).toBe(true);

    await expect(page.getByRole('heading', { level: 1, name: 'Programa' })).toBeVisible();
    await expect(page.getByText(/solo lectura: no tienes permiso para editar/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /guardar cambios/i })).toHaveCount(0);

    await expectNoContrastViolations(page, { context: 'program-config-readonly-desktop' });
  });

  test('semesters page has no contrast violations in editable mode with data (HU-010, T-010-11)', async ({
    page,
  }) => {
    const adminEmail = `contrast-admin-sem-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    const [semRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/semesters') && res.status() === 200),
      page.goto('/configuracion/semestres'),
    ]);
    expect(semRes.ok()).toBe(true);

    await expect(page.getByRole('heading', { level: 1, name: 'Semestres' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Registrar nuevo semestre' }),
    ).toBeVisible();

    // 1. Escritorio antes de registrar
    await expectNoContrastViolations(page, { context: 'semesters-page-desktop' });

    // 2. Móvil
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { context: 'semesters-page-mobile' });
    await page.setViewportSize({ width: 1280, height: 720 });

    // 3. Registrar un semestre con año único (D8) para probar tabla con datos
    const uniqueYear = 3000 + (Date.now() % 6000);
    await page.getByLabel(/código/i).fill(`${uniqueYear}-I`);
    await page.getByLabel(/fecha de inicio/i).fill(`${uniqueYear}-03-15`);
    await page.getByLabel(/fecha de fin/i).fill(`${uniqueYear}-07-15`);

    const [createRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/semesters') && res.status() === 201),
      page.getByRole('button', { name: /registrar semestre/i }).click(),
    ]);
    expect(createRes.ok()).toBe(true);

    await expect(page.getByText(`${uniqueYear}-I`)).toBeVisible();
    await expectNoContrastViolations(page, { context: 'semesters-page-with-data-desktop' });
  });

  test('semesters page has no contrast violations in read-only mode (HU-010, T-010-11)', async ({
    page,
  }) => {
    const committeeEmail = `contrast-committee-sem-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: committeeEmail,
      roles: ['COMMITTEE_MEMBER'],
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    const [semResReadonly] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/semesters') && res.status() === 200),
      page.goto('/configuracion/semestres'),
    ]);
    expect(semResReadonly.ok()).toBe(true);

    await expect(page.getByRole('heading', { level: 1, name: 'Semestres' })).toBeVisible();
    await expect(
      page.getByText(/solo lectura: no tienes permiso para registrar semestres/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /registrar semestre/i })).toHaveCount(0);

    await expectNoContrastViolations(page, { context: 'semesters-page-readonly-desktop' });
  });

  test('parameters page has no contrast violations with history open and weights error (HU-011, T-011-13)', async ({
    page,
  }) => {
    const adminEmail = `contrast-admin-par-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: adminEmail,
      roles: ['ADMINISTRATOR'],
    });

    // Un semestre propio (año único) para poder elegir la vigencia en el formulario.
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/configuracion/semestres');
    const uniqueYear = 3000 + (Date.now() % 6000);
    await page.getByLabel(/código/i).fill(`${uniqueYear}-I`);
    await page.getByLabel(/fecha de inicio/i).fill(`${uniqueYear}-03-15`);
    await page.getByLabel(/fecha de fin/i).fill(`${uniqueYear}-07-15`);
    const [createRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/semesters') && res.status() === 201),
      page.getByRole('button', { name: /registrar semestre/i }).click(),
    ]);
    expect(createRes.ok()).toBe(true);

    const [parametersRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/parameters') && res.status() === 200),
      page.goto('/configuracion/parametros'),
    ]);
    expect(parametersRes.ok()).toBe(true);
    await expect(page.getByRole('heading', { level: 1, name: 'Parámetros' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Valores vigentes' })).toBeVisible();

    // 1. Escritorio con un historial abierto
    await page.getByText('Umbral de logrado', { exact: false }).last().click();
    await expectNoContrastViolations(page, { context: 'parameters-page-history-desktop' });

    // 2. Móvil
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoContrastViolations(page, { context: 'parameters-page-mobile' });
    await page.setViewportSize({ width: 1280, height: 720 });

    // 3. Error de pesos visible (el esquema compartido lo rechaza antes de llamar a la API)
    const [formRes] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/parameters?semesterCode=') &&
          res.url().includes(String(uniqueYear)) &&
          res.status() === 200,
      ),
      page.getByLabel('Vigente desde el semestre').selectOption(`${uniqueYear}-I`),
    ]);
    expect(formRes.ok()).toBe(true);
    await expect(page.getByRole('spinbutton', { name: 'Peso de la medición directa' })).toHaveValue(
      '70',
    );
    await page.getByRole('spinbutton', { name: 'Peso de la medición directa' }).fill('80');
    await page.getByRole('button', { name: 'Guardar parámetros' }).click();
    await expect(page.getByText(/deben sumar 100/i).first()).toBeVisible();
    await expectNoContrastViolations(page, { context: 'parameters-page-weights-error-desktop' });
  });

  test('parameters page has no contrast violations in read-only mode (HU-011, T-011-13)', async ({
    page,
  }) => {
    const committeeEmail = `contrast-committee-par-${Date.now()}@example.test`;
    await loginAsTestUser(page, {
      email: committeeEmail,
      roles: ['COMMITTEE_MEMBER'],
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    const [parametersRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/parameters') && res.status() === 200),
      page.goto('/configuracion/parametros'),
    ]);
    expect(parametersRes.ok()).toBe(true);

    await expect(page.getByRole('heading', { level: 1, name: 'Parámetros' })).toBeVisible();
    await expect(
      page.getByText(/solo lectura: no tienes permiso para modificar los parámetros/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar parámetros' })).toHaveCount(0);

    await expectNoContrastViolations(page, { context: 'parameters-page-readonly-desktop' });
  });
});
