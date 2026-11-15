import { test, expect } from './support/test';
import { DESKTOP, MOBILE, expectNoContrastViolations, waitForApi } from './support/contrast';
import { resetTemplates, seedTemplate } from './support/template-data';
import { loginAsTestUser } from './support/seed-user';

test.describe('Color Contrast Accessibility (WCAG 2.1 AA) — Templates', () => {
  test.setTimeout(120_000);

  test('templates route has no contrast violations in list, editor and publish confirmation', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page, {
      email: `contrast-admin-templates-${Date.now()}@example.test`,
      roles: ['ADMINISTRATOR'],
    });
    await resetTemplates();
    const templateId = await seedTemplate({ withDraft: true });

    try {
      await waitForApi(page, '/templates', () => page.goto('/plantillas'));
      await expect(
        page.getByRole('heading', { level: 1, name: 'Plantillas oficiales' }),
      ).toBeVisible();
      await expect(page.getByRole('cell', { name: 'FO-E2E', exact: true })).toBeVisible();
      await expectNoContrastViolations(page, { context: 'templates-list-desktop' });

      await page.setViewportSize(MOBILE);
      await expect(page.getByRole('cell', { name: 'FO-E2E', exact: true })).toBeVisible();
      await expectNoContrastViolations(page, { context: 'templates-list-mobile' });

      // Plantilla abierta en edición, con su borrador y las variables
      await page.setViewportSize(DESKTOP);
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().endsWith(`/templates/${templateId}`) && res.status() === 200,
        ),
        page.getByRole('button', { name: 'Abrir FO-E2E' }).click(),
      ]);
      await expect(page.getByRole('textbox', { name: 'Contenido HTML' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Insertar {{program.name}}' })).toBeVisible();
      await expectNoContrastViolations(page, { context: 'templates-editor-desktop' });

      await page.setViewportSize(MOBILE);
      await expect(page.getByRole('textbox', { name: 'Contenido HTML' })).toBeVisible();
      await expectNoContrastViolations(page, { context: 'templates-editor-mobile' });

      // Confirmación de publicar abierta
      await page.setViewportSize(DESKTOP);
      await page.getByRole('button', { name: 'Publicar versión 2' }).click();
      await expect(
        page.getByRole('alertdialog', { name: 'Confirmar la publicación' }),
      ).toBeVisible();
      await expectNoContrastViolations(page, { context: 'templates-confirm-desktop' });

      await page.setViewportSize(MOBILE);
      await expect(
        page.getByRole('alertdialog', { name: 'Confirmar la publicación' }),
      ).toBeVisible();
      await expectNoContrastViolations(page, { context: 'templates-confirm-mobile' });
    } finally {
      await resetTemplates();
    }
  });

  test('templates route has no contrast violations in read-only mode', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    // El Presidente del Comité solo consulta las plantillas (matriz por defecto)
    await loginAsTestUser(page, {
      email: `contrast-president-templates-${Date.now()}@example.test`,
      roles: ['COMMITTEE_PRESIDENT'],
    });
    await resetTemplates();
    const templateId = await seedTemplate({ withDraft: true });

    try {
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().endsWith(`/templates/${templateId}`) && res.status() === 200,
        ),
        page.goto(`/plantillas?id=${templateId}`),
      ]);
      await expect(page.getByRole('textbox', { name: 'Contenido HTML' })).toHaveAttribute(
        'readonly',
        '',
      );
      await expect(page.getByRole('button', { name: 'Guardar borrador' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Publicar versión/ })).toHaveCount(0);
      await expectNoContrastViolations(page, { context: 'templates-readonly-desktop' });

      await page.setViewportSize(MOBILE);
      await expect(page.getByRole('textbox', { name: 'Contenido HTML' })).toBeVisible();
      await expectNoContrastViolations(page, { context: 'templates-readonly-mobile' });
    } finally {
      await resetTemplates();
    }
  });
});
