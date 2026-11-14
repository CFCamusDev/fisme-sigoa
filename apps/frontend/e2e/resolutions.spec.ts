import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import {
  resetCatalog,
  seedCurrentCatalog,
  seedInValidationCatalogVersion,
} from './support/catalog-data';
import { loginAsTestUser } from './support/seed-user';

const RESOLUTIONS_PATH = '/resolutions';

/** Abre la página y espera el listado de la API (sin esperas fijas). */
async function openResolutionsPage(page: Page) {
  await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes(RESOLUTIONS_PATH) &&
        res.request().method() === 'GET' &&
        res.status() === 200,
    ),
    page.goto('/resoluciones'),
  ]);
  await expect(page.getByRole('heading', { level: 1, name: 'Resoluciones' })).toBeVisible();
}

test.describe('HU-048 — Registrar y aprobar resoluciones E2E', () => {
  test.setTimeout(90_000);

  test.afterEach(() => {
    resetCatalog();
  });

  test('president registers and approves an objectives resolution with the signed pdf (CA1, CA2, CA3)', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await loginAsTestUser(page, {
      email: `e2e-resolutions-${Date.now()}@example.test`,
      roles: ['COMMITTEE_PRESIDENT'],
    });
    resetCatalog();
    seedCurrentCatalog();
    seedInValidationCatalogVersion();

    await openResolutionsPage(page);
    await expect(page.getByText('Aún no hay resoluciones registradas')).toBeVisible();

    // Registrar la resolución vinculada a la versión En validación (CA1)
    await page.getByRole('button', { name: 'Registrar resolución' }).click();
    const registerForm = page.getByRole('form', { name: 'Registrar resolución' });
    await expect(registerForm.getByLabel('Versión del catálogo')).toHaveValue(/.+/);
    await registerForm.getByLabel('Número de resolución').fill('RD-012/2027-FISME');
    await registerForm.getByLabel('Fecha de la resolución').fill('2026-11-10');
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().endsWith(RESOLUTIONS_PATH) &&
          res.request().method() === 'POST' &&
          res.status() === 201,
      ),
      registerForm.getByRole('button', { name: 'Registrar resolución' }).click(),
    ]);
    await expect(page.getByText(/Se registró la resolución RD-012\/2027-FISME/)).toBeVisible();
    const row = page.getByRole('row').filter({ hasText: 'RD-012/2027-FISME' });
    await expect(row.getByText('Registrada')).toBeVisible();
    await expect(row.getByText('Pendiente')).toBeVisible();
    await expect(row.getByText('V2')).toBeVisible();

    // Sin PDF no se aprueba (CA3)
    await page.getByRole('button', { name: 'Aprobar resolución RD-012/2027-FISME' }).click();
    const approveForm = page.getByRole('form', { name: 'Aprobar resolución RD-012/2027-FISME' });
    await approveForm.getByRole('button', { name: 'Aprobar resolución' }).click();
    await expect(approveForm.getByText('Selecciona el PDF firmado para aprobar.')).toBeVisible();
    await expect(row.getByText('Registrada')).toBeVisible();

    // Con el PDF firmado pasa a Aprobada y queda adjunto (CA2)
    await approveForm.getByLabel('PDF firmado').setInputFiles({
      name: 'resolucion-firmada.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n% resolución firmada de prueba\n'),
    });
    await expect(approveForm.getByText(/resolucion-firmada\.pdf/)).toBeVisible();
    await Promise.all([
      page.waitForResponse(
        (res) =>
          /\/resolutions\/[^/]+\/approve$/.test(res.url()) &&
          res.request().method() === 'POST' &&
          res.status() === 200,
      ),
      approveForm.getByRole('button', { name: 'Aprobar resolución' }).click(),
    ]);
    await expect(page.getByText(/Se aprobó la resolución RD-012\/2027-FISME/)).toBeVisible();
    await expect(row.getByText('Aprobada')).toBeVisible();
    await expect(row.getByText('Adjunto')).toBeVisible();
    await expect(page.getByRole('button', { name: /Aprobar resolución RD-012/ })).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
