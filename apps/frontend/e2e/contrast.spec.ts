import { test, expect } from './support/test';
import type { Page } from '@playwright/test';
import { expectNoContrastViolations } from './support/contrast';
import {
  resetCatalog,
  resetResolutions,
  seedCurrentCatalog,
  seedHistoricalCatalog,
  seedInValidationCatalogVersion,
  seedResolution,
} from './support/catalog-data';
import { loginAsTestUser, seedUser } from './support/seed-user';

/**
 * Contraste de color WCAG 2.1 AA, agrupado por ruta (HU-078, T-078-19): cada grupo inicia sesión una
 * sola vez y recorre sus pantallas y viewports dentro de la misma prueba. El conjunto de `context`
 * está fijado por `src/e2e-hygiene.test.ts`: no se puede perder ninguna ruta ni viewport.
 */
const DESKTOP = { width: 1280, height: 720 };
const MOBILE = { width: 375, height: 812 };

async function waitForApi(page: Page, fragment: string, goTo: () => Promise<unknown>) {
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes(fragment) && res.status() === 200),
    goTo(),
  ]);
  expect(response.ok()).toBe(true);
}

test.describe('Color Contrast Accessibility (WCAG 2.1 AA)', () => {
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
    await expect(page.getByRole('button', { name: /cerrar sesión/i })).toBeVisible();
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

  test('user routes have no contrast violations', async ({ page }) => {
    const timestamp = Date.now();
    const suffix = timestamp % 10000;
    const targetSurname = `Destino${suffix}`;
    const editSurname = `Objetivo${suffix}`;
    const accessSurname = `Acceso${suffix}`;
    const draftSurname = `Borrador${suffix}`;

    seedUser({
      email: `contrast-target-${timestamp}@example.test`,
      names: 'Usuario',
      firstSurname: targetSurname,
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });
    seedUser({
      email: `contrast-edit-target-${timestamp}@example.test`,
      names: 'Editar',
      firstSurname: editSurname,
      secondSurname: 'Prueba',
      dni: String(40000000 + (timestamp % 10000000)),
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });
    seedUser({
      email: `contrast-target-access-${timestamp}@example.test`,
      names: 'Usuario',
      firstSurname: accessSurname,
      secondSurname: 'Permisos',
      dni: String(50000000 + (timestamp % 10000000)),
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });
    seedUser({
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
    await expect(page.getByRole('heading', { name: 'Roles asignados' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Permisos directos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Permisos efectivos' })).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'Roles asignados' })).toBeVisible();
    await page.locator('input[type="checkbox"]:not(:checked)').first().click();
    await expect(page.getByText(/cambio sin guardar/i).first()).toBeVisible();
    await expectNoContrastViolations(page, { context: 'user-access-panel-unsaved-changes' });
  });

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

  test('program, semesters and parameters routes have no contrast violations in editable mode', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page, {
      email: `contrast-admin-config-${Date.now()}@example.test`,
      roles: ['ADMINISTRATOR'],
    });

    // Programa
    await waitForApi(page, '/program', () => page.goto('/configuracion/programa'));
    await expect(page.getByRole('heading', { level: 1, name: 'Programa' })).toBeVisible();
    await expect(page.getByRole('button', { name: /guardar cambios/i })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'program-config-editable-desktop' });
    await page.setViewportSize(MOBILE);
    await expectNoContrastViolations(page, { context: 'program-config-editable-mobile' });
    await page.setViewportSize(DESKTOP);

    // Semestres: antes de registrar, móvil y con datos (año único)
    const baseYear = 3000 + (Date.now() % 5000);
    await waitForApi(page, '/semesters', () => page.goto('/configuracion/semestres'));
    await expect(page.getByRole('heading', { level: 1, name: 'Semestres' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Registrar nuevo semestre' }),
    ).toBeVisible();
    await expectNoContrastViolations(page, { context: 'semesters-page-desktop' });
    await page.setViewportSize(MOBILE);
    await expectNoContrastViolations(page, { context: 'semesters-page-mobile' });
    await page.setViewportSize(DESKTOP);

    const registerSemester = async (year: number) => {
      await page.getByLabel(/código/i).fill(`${year}-I`);
      await page.getByLabel(/fecha de inicio/i).fill(`${year}-03-15`);
      await page.getByLabel(/fecha de fin/i).fill(`${year}-07-15`);
      const [createRes] = await Promise.all([
        page.waitForResponse((res) => res.url().includes('/semesters') && res.status() === 201),
        page.getByRole('button', { name: /registrar semestre/i }).click(),
      ]);
      expect(createRes.ok()).toBe(true);
    };
    await registerSemester(baseYear);
    await expect(page.getByText(`${baseYear}-I`)).toBeVisible();
    await expectNoContrastViolations(page, { context: 'semesters-page-with-data-desktop' });

    // Parámetros: un semestre propio (año único distinto) para elegir la vigencia
    const parametersYear = baseYear + 1000;
    await registerSemester(parametersYear);
    await waitForApi(page, '/parameters', () => page.goto('/configuracion/parametros'));
    await expect(page.getByRole('heading', { level: 1, name: 'Parámetros' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Valores vigentes' })).toBeVisible();

    await page.getByText('Umbral de logrado', { exact: false }).last().click();
    await expectNoContrastViolations(page, { context: 'parameters-page-history-desktop' });
    await page.setViewportSize(MOBILE);
    await expectNoContrastViolations(page, { context: 'parameters-page-mobile' });
    await page.setViewportSize(DESKTOP);

    // Error de pesos visible (el esquema compartido lo rechaza antes de llamar a la API)
    const [formRes] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/parameters?semesterCode=') &&
          res.url().includes(String(parametersYear)) &&
          res.status() === 200,
      ),
      page.getByLabel('Vigente desde el semestre').selectOption(`${parametersYear}-I`),
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

  test('response scales route has no contrast violations in editable mode', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page, {
      email: `contrast-admin-scales-${Date.now()}@example.test`,
      roles: ['ADMINISTRATOR'],
    });

    await waitForApi(page, '/response-scales', () => page.goto('/configuracion/escalas'));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Escalas de respuesta' }),
    ).toBeVisible();

    // Formulario de crear con errores visibles (el esquema compartido los rechaza antes de la API)
    await page.getByRole('button', { name: 'Nueva escala' }).first().click();
    await expect(page.getByRole('heading', { level: 2, name: 'Nueva escala' })).toBeVisible();
    await page.getByRole('button', { name: 'Guardar escala' }).click();
    await expect(page.getByLabel('Código', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expectNoContrastViolations(page, {
      context: 'response-scales-create-form-error-desktop',
    });

    // Una escala propia (código único) creada desde la pantalla
    const code = `E2E_${Date.now()}`;
    const name = `Escala de contraste ${code}`;
    await page.getByLabel('Código', { exact: true }).fill(code);
    await page.getByLabel('Nombre', { exact: true }).fill(name);
    await page.getByLabel('Etiqueta del nivel 1').fill('Bajo');
    await page.getByLabel('Valor del nivel 1').fill('1');
    await page.getByLabel('Etiqueta del nivel 2').fill('Alto');
    await page.getByLabel('Valor del nivel 2').fill('2');
    await page.getByLabel('Cuenta como logro del nivel 2').check();
    const [createRes] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/response-scales') &&
          res.request().method() === 'POST' &&
          res.status() === 201,
      ),
      page.getByRole('button', { name: 'Guardar escala' }).click(),
    ]);
    expect(createRes.ok()).toBe(true);
    await expect(page.getByText('Escala creada.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();

    await expectNoContrastViolations(page, { context: 'response-scales-page-desktop' });
    await page.setViewportSize(MOBILE);
    await expectNoContrastViolations(page, { context: 'response-scales-page-mobile' });
    await page.setViewportSize(DESKTOP);

    // Panel de duplicar abierto en la tarjeta de la escala propia
    await page.getByRole('region', { name }).getByRole('button', { name: 'Duplicar' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Duplicar escala' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'response-scales-duplicate-panel-desktop' });
  });

  test('program, semesters and parameters routes have no contrast violations in read-only mode', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page, {
      email: `contrast-committee-config-${Date.now()}@example.test`,
      roles: ['COMMITTEE_MEMBER'],
    });

    await waitForApi(page, '/program', () => page.goto('/configuracion/programa'));
    await expect(page.getByRole('heading', { level: 1, name: 'Programa' })).toBeVisible();
    await expect(page.getByText(/solo lectura: no tienes permiso para editar/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /guardar cambios/i })).toHaveCount(0);
    await expectNoContrastViolations(page, { context: 'program-config-readonly-desktop' });

    await waitForApi(page, '/semesters', () => page.goto('/configuracion/semestres'));
    await expect(page.getByRole('heading', { level: 1, name: 'Semestres' })).toBeVisible();
    await expect(
      page.getByText(/solo lectura: no tienes permiso para registrar semestres/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /registrar semestre/i })).toHaveCount(0);
    await expectNoContrastViolations(page, { context: 'semesters-page-readonly-desktop' });

    await waitForApi(page, '/parameters', () => page.goto('/configuracion/parametros'));
    await expect(page.getByRole('heading', { level: 1, name: 'Parámetros' })).toBeVisible();
    await expect(
      page.getByText(/solo lectura: no tienes permiso para modificar los parámetros/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar parámetros' })).toHaveCount(0);
    await expectNoContrastViolations(page, { context: 'parameters-page-readonly-desktop' });

    await waitForApi(page, '/response-scales', () => page.goto('/configuracion/escalas'));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Escalas de respuesta' }),
    ).toBeVisible();
    await expect(
      page.getByText(/solo lectura: no tienes permiso para modificar las escalas/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nueva escala' })).toHaveCount(0);
    await expectNoContrastViolations(page, { context: 'response-scales-readonly-desktop' });
  });

  test('catalog versions route has no contrast violations in empty, open and read-only states', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page, {
      email: `contrast-president-catalog-${Date.now()}@example.test`,
      roles: ['COMMITTEE_PRESIDENT'],
    });

    // Sin versiones: estado vacío con la acción «Nueva versión»
    await waitForApi(page, '/catalog-versions', () => page.goto('/catalogo/versiones'));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Versiones del catálogo' }),
    ).toBeVisible();
    await expect(page.getByText('Aún no hay versiones del catálogo')).toBeVisible();
    await expectNoContrastViolations(page, { context: 'catalog-versions-empty-desktop' });

    // Crear la primera versión deja una abierta: aviso de éxito, tabla y ayuda de bloqueo (CA2)
    const [createRes] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/catalog-versions') &&
          res.request().method() === 'POST' &&
          res.status() === 201,
      ),
      page.getByRole('button', { name: 'Nueva versión' }).click(),
    ]);
    expect(createRes.ok()).toBe(true);
    await expect(page.getByText(/Se creó la versión 1 en Borrador/)).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText(/Ya existe la versión 1 en Borrador/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nueva versión' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expectNoContrastViolations(page, { context: 'catalog-versions-with-open-desktop' });

    await page.setViewportSize(MOBILE);
    await expect(page.getByRole('table')).toBeVisible();
    await expectNoContrastViolations(page, { context: 'catalog-versions-with-open-mobile' });
  });

  test('catalog versions route has no contrast violations in read-only mode', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    // El Administrador puede consultar el catálogo pero no tiene catalogo.editar (matriz por defecto)
    await loginAsTestUser(page, {
      email: `contrast-admin-catalog-${Date.now()}@example.test`,
      roles: ['ADMINISTRATOR'],
    });

    await waitForApi(page, '/catalog-versions', () => page.goto('/catalogo/versiones'));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Versiones del catálogo' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nueva versión' })).toHaveCount(0);
    await expectNoContrastViolations(page, { context: 'catalog-versions-readonly-desktop' });
  });

  test('catalog version editor has no contrast violations in draft and read-only states', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page, {
      email: `contrast-member-catalog-editor-${Date.now()}@example.test`,
      roles: ['COMMITTEE_MEMBER'],
    });
    resetCatalog();
    seedCurrentCatalog();

    try {
      // Crear el Borrador desde la interfaz y abrir su editor
      await waitForApi(page, '/catalog-versions', () => page.goto('/catalogo/versiones'));
      await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().endsWith('/catalog-versions') &&
            res.request().method() === 'POST' &&
            res.status() === 201,
        ),
        page.getByRole('button', { name: 'Nueva versión' }).click(),
      ]);
      await Promise.all([
        page.waitForResponse(
          (res) =>
            //catalog-versions/[^/]+$/.test(res.url()) &&
            res.request().method() === 'GET' && res.status() === 200,
        ),
        page.getByRole('link', { name: 'Editar V2' }).click(),
      ]);

      // Un AG modificado y uno nuevo muestran las dos insignias de cambio
      await page.getByRole('button', { name: 'Editar AG-C01' }).click();
      await page.getByLabel('Enunciado').fill('Enunciado modificado para la prueba de contraste.');
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().endsWith('/attributes') && res.request().method() === 'PUT',
        ),
        page.getByRole('button', { name: 'Guardar' }).click(),
      ]);
      await page.getByRole('button', { name: 'Agregar atributo' }).click();
      await page.getByLabel('Código').fill('AG-C99');
      await page.getByLabel('Nombre').fill('Atributo nuevo');
      await page.getByLabel('Enunciado').fill('Enunciado del atributo nuevo.');
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().endsWith('/attributes') && res.request().method() === 'PUT',
        ),
        page.getByRole('button', { name: 'Guardar' }).click(),
      ]);
      const attributeList = page.getByRole('list', { name: 'Atributos del graduado' });
      await expect(attributeList.getByText(/^Modificado/)).toBeVisible();
      await expect(attributeList.getByText(/^Nuevo/)).toBeVisible();
      await expectNoContrastViolations(page, { context: 'catalog-editor-draft-desktop' });

      await page.setViewportSize(MOBILE);
      await expect(page.getByRole('list', { name: 'Atributos del graduado' })).toBeVisible();
      await expectNoContrastViolations(page, { context: 'catalog-editor-draft-mobile' });

      // La versión vigente se ve bloqueada, con los campos deshabilitados
      await page.setViewportSize(DESKTOP);
      await waitForApi(page, '/catalog-versions', () => page.goto('/catalogo/versiones'));
      await Promise.all([
        page.waitForResponse(
          (res) =>
            //catalog-versions/[^/]+$/.test(res.url()) &&
            res.request().method() === 'GET' && res.status() === 200,
        ),
        page.getByRole('link', { name: 'Ver V1' }).click(),
      ]);
      await expect(page.getByText(/sus campos están bloqueados/)).toBeVisible();
      await expect(page.getByLabel('Enunciado').first()).toBeDisabled();
      await expectNoContrastViolations(page, { context: 'catalog-editor-readonly-desktop' });

      await page.setViewportSize(MOBILE);
      await expect(page.getByLabel('Enunciado').first()).toBeDisabled();
      await expectNoContrastViolations(page, { context: 'catalog-editor-readonly-mobile' });
    } finally {
      resetCatalog();
    }
  });

  test('catalog history route has no contrast violations in empty and comparison states', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page, {
      email: `contrast-member-catalog-history-${Date.now()}@example.test`,
      roles: ['COMMITTEE_MEMBER'],
    });
    resetCatalog();
    seedCurrentCatalog();

    try {
      // Con una sola versión no hay nada que comparar
      await waitForApi(page, '/catalog-versions', () => page.goto('/catalogo/historial'));
      await expect(page.getByText('Aún no hay versiones para comparar')).toBeVisible();
      await expectNoContrastViolations(page, { context: 'catalog-history-empty-desktop' });

      // Con dos versiones se comparan por defecto la anterior y la vigente
      seedHistoricalCatalog();
      await waitForApi(page, '/compare/', () => page.goto('/catalogo/historial'));
      await expect(page.getByRole('heading', { name: 'Resumen de cambios' })).toBeVisible();
      await expect(page.locator('ins').first()).toBeVisible();
      await expect(page.getByText('Resolución N.° E2E-128-2024')).toBeVisible();
      await expectNoContrastViolations(page, { context: 'catalog-history-compare-desktop' });

      await page.setViewportSize(MOBILE);
      await expect(page.getByRole('heading', { name: 'Resumen de cambios' })).toBeVisible();
      await expectNoContrastViolations(page, { context: 'catalog-history-compare-mobile' });

      // La versión Histórica muestra su resolución y vigencia en el editor
      await page.setViewportSize(DESKTOP);
      await waitForApi(page, '/catalog-versions', () => page.goto('/catalogo/versiones'));
      await Promise.all([
        page.waitForResponse(
          (res) =>
            /\/catalog-versions\/[^/?]+$/.test(res.url()) &&
            res.request().method() === 'GET' &&
            res.status() === 200,
        ),
        page.getByRole('link', { name: 'Ver V1' }).click(),
      ]);
      await expect(page.getByRole('region', { name: 'Resolución y vigencia' })).toBeVisible();
      await expectNoContrastViolations(page, { context: 'catalog-editor-history-desktop' });
    } finally {
      resetCatalog();
    }
  });

  test('resolutions route has no contrast violations in empty, approval and approved states', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page, {
      email: `contrast-president-resolutions-${Date.now()}@example.test`,
      roles: ['COMMITTEE_PRESIDENT'],
    });
    resetCatalog();
    seedCurrentCatalog();
    seedInValidationCatalogVersion();

    try {
      // Sin resoluciones: estado vacío
      await waitForApi(page, '/resolutions', () => page.goto('/resoluciones'));
      await expect(page.getByRole('heading', { level: 1, name: 'Resoluciones' })).toBeVisible();
      await expect(page.getByText('Aún no hay resoluciones registradas')).toBeVisible();
      await expectNoContrastViolations(page, { context: 'resolutions-empty-desktop' });

      // Una fila Registrada con el formulario de aprobación abierto
      seedResolution({ number: 'RD-001/2027', status: 'REGISTERED' });
      await waitForApi(page, '/resolutions', () => page.reload());
      await page.getByRole('button', { name: 'Aprobar resolución RD-001/2027' }).click();
      await expect(
        page.getByRole('form', { name: 'Aprobar resolución RD-001/2027' }),
      ).toBeVisible();
      await expectNoContrastViolations(page, {
        context: 'resolutions-registered-approval-desktop',
      });

      await page.setViewportSize(MOBILE);
      await expect(
        page.getByRole('form', { name: 'Aprobar resolución RD-001/2027' }),
      ).toBeVisible();
      await expectNoContrastViolations(page, { context: 'resolutions-registered-approval-mobile' });

      // Una fila Aprobada
      resetResolutions();
      seedResolution({ number: 'RD-002/2027', status: 'APPROVED' });
      await page.setViewportSize(DESKTOP);
      await waitForApi(page, '/resolutions', () => page.reload());
      await expect(page.getByRole('cell', { name: 'Aprobada' })).toBeVisible();
      await expectNoContrastViolations(page, { context: 'resolutions-approved-desktop' });

      await page.setViewportSize(MOBILE);
      await expect(page.getByRole('cell', { name: 'Aprobada' })).toBeVisible();
      await expectNoContrastViolations(page, { context: 'resolutions-approved-mobile' });
    } finally {
      resetCatalog();
    }
  });

  test('resolutions route has no contrast violations in read-only mode', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    // El Miembro del Comité solo consulta las resoluciones (matriz por defecto)
    await loginAsTestUser(page, {
      email: `contrast-member-resolutions-${Date.now()}@example.test`,
      roles: ['COMMITTEE_MEMBER'],
    });
    resetCatalog();
    seedCurrentCatalog();
    seedInValidationCatalogVersion();
    seedResolution({ number: 'RD-003/2027', status: 'REGISTERED' });

    try {
      await waitForApi(page, '/resolutions', () => page.goto('/resoluciones'));
      await expect(page.getByRole('cell', { name: 'RD-003/2027' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Registrar resolución/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Aprobar resolución/ })).toHaveCount(0);
      await expectNoContrastViolations(page, { context: 'resolutions-readonly-desktop' });

      await page.setViewportSize(MOBILE);
      await expect(page.getByRole('cell', { name: 'RD-003/2027' })).toBeVisible();
      await expectNoContrastViolations(page, { context: 'resolutions-readonly-mobile' });
    } finally {
      resetCatalog();
    }
  });
});
