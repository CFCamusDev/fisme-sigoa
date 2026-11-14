import { test, expect } from './support/test';
import { DESKTOP, MOBILE, expectNoContrastViolations, waitForApi } from './support/contrast';
import {
  resetCatalog,
  resetResolutions,
  seedCurrentCatalog,
  seedInValidationCatalogVersion,
  seedResolution,
} from './support/catalog-data';
import { loginAsTestUser } from './support/seed-user';

test.describe('Color Contrast Accessibility (WCAG 2.1 AA) — Resolutions', () => {
  test.setTimeout(120_000);

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
