import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { resetCatalog, seedCurrentCatalog } from './support/catalog-data';
import { loginAsTestUser } from './support/seed-user';

const BASE_PATH = '/catalog-versions';

/** Abre la lista de versiones y espera la respuesta de la API (sin esperas fijas). */
async function openVersionsPage(page: Page) {
  await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().endsWith(BASE_PATH) && res.request().method() === 'GET' && res.status() === 200,
    ),
    page.goto('/catalogo/versiones'),
  ]);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Versiones del catálogo' }),
  ).toBeVisible();
}

test.describe('HU-014 — Editar OE y AG de una versión E2E', () => {
  test.setTimeout(90_000);

  test.afterEach(() => {
    resetCatalog();
  });

  test('member edits an attribute statement in a draft version and sees the difference (CA1, CA2, CA3)', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await loginAsTestUser(page, {
      email: `e2e-catalog-editor-${Date.now()}@example.test`,
      roles: ['COMMITTEE_MEMBER'],
    });
    resetCatalog();
    seedCurrentCatalog();

    // Crear el Borrador desde la interfaz (copia de la vigente)
    await openVersionsPage(page);
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().endsWith(BASE_PATH) &&
          res.request().method() === 'POST' &&
          res.status() === 201,
      ),
      page.getByRole('button', { name: 'Nueva versión' }).click(),
    ]);
    await expect(page.getByText(/Se creó la versión 2 en Borrador/)).toBeVisible();

    // Abrir el editor del Borrador
    await Promise.all([
      page.waitForResponse(
        (res) =>
          /\/catalog-versions\/[^/]+$/.test(res.url()) &&
          res.request().method() === 'GET' &&
          res.status() === 200,
      ),
      page.getByRole('link', { name: 'Editar V2' }).click(),
    ]);
    await expect(page).toHaveURL(/\/catalog\/versions\/[^/]+$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /Versión V2 del catálogo/ }),
    ).toBeVisible();
    const attributes = page.getByRole('list', { name: 'Atributos del graduado' });
    await expect(attributes.getByRole('listitem')).toHaveCount(12);
    await expect(attributes.getByText('Modificado')).toHaveCount(0);

    // Editar el enunciado de un AG y guardarlo (CA1)
    await page.getByRole('button', { name: 'Editar AG-C03' }).click();
    const statement = page.getByLabel('Enunciado');
    await statement.fill('Enunciado editado durante la prueba de extremo a extremo.');
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().endsWith('/attributes') &&
          res.request().method() === 'PUT' &&
          res.status() === 200,
      ),
      page.getByRole('button', { name: 'Guardar' }).click(),
    ]);
    await expect(page.getByText(/Se guardaron los cambios de AG-C03/)).toBeVisible();
    const row = attributes.getByRole('listitem').filter({ hasText: 'AG-C03' });
    await expect(row.getByText('Modificado')).toBeVisible();
    await expect(
      row.getByText('Enunciado editado durante la prueba de extremo a extremo.'),
    ).toBeVisible();

    // Un código repetido se rechaza (CA2)
    await page.getByRole('button', { name: 'Agregar atributo' }).click();
    await page.getByLabel('Código').fill('AG-C01');
    await page.getByLabel('Nombre').fill('Repetido');
    await page.getByLabel('Enunciado').fill('Un atributo con el código de otro.');
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().endsWith('/attributes') &&
          res.request().method() === 'PUT' &&
          res.status() === 409,
      ),
      page.getByRole('button', { name: 'Guardar' }).click(),
    ]);
    await expect(page.getByText(/Ya existe un elemento con ese código/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    // Recargar conserva el cambio y la diferencia con la vigente
    await Promise.all([
      page.waitForResponse(
        (res) =>
          /\/catalog-versions\/[^/]+$/.test(res.url()) &&
          res.request().method() === 'GET' &&
          res.status() === 200,
      ),
      page.reload(),
    ]);
    const reloaded = page
      .getByRole('list', { name: 'Atributos del graduado' })
      .getByRole('listitem')
      .filter({ hasText: 'AG-C03' });
    await expect(reloaded.getByText('Modificado')).toBeVisible();

    // La versión vigente está bloqueada (CA3)
    await openVersionsPage(page);
    await Promise.all([
      page.waitForResponse(
        (res) =>
          /\/catalog-versions\/[^/]+$/.test(res.url()) &&
          res.request().method() === 'GET' &&
          res.status() === 200,
      ),
      page.getByRole('link', { name: 'Ver V1' }).click(),
    ]);
    await expect(page.getByText(/sus campos están bloqueados/)).toBeVisible();
    await expect(page.getByLabel('Enunciado').first()).toBeDisabled();
    await expect(page.getByRole('button', { name: /Editar AG-C03/ })).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
