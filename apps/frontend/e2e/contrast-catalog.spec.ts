import { test, expect } from './support/test';
import { DESKTOP, MOBILE, expectNoContrastViolations, waitForApi } from './support/contrast';
import { resetCatalog, seedCurrentCatalog, seedHistoricalCatalog } from './support/catalog-data';
import { loginAsTestUser } from './support/seed-user';

test.describe('Color Contrast Accessibility (WCAG 2.1 AA) — Catalog', () => {
  test.setTimeout(120_000);

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
    await resetCatalog();
    await seedCurrentCatalog();

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
      await resetCatalog();
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
    await resetCatalog();
    await seedCurrentCatalog();

    try {
      // Con una sola versión no hay nada que comparar
      await waitForApi(page, '/catalog-versions', () => page.goto('/catalogo/historial'));
      await expect(page.getByText('Aún no hay versiones para comparar')).toBeVisible();
      await expectNoContrastViolations(page, { context: 'catalog-history-empty-desktop' });

      // Con dos versiones se comparan por defecto la anterior y la vigente
      await seedHistoricalCatalog();
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
      await resetCatalog();
    }
  });
});
