import { test, expect } from './support/test';
import { DESKTOP, MOBILE, expectNoContrastViolations, waitForApi } from './support/contrast';
import { loginAsTestUser } from './support/seed-user';
import { resetStakeholders, seedStakeholder } from './support/stakeholder-data';

test.describe('Color Contrast Accessibility (WCAG 2.1 AA) — Stakeholder Lists', () => {
  test.setTimeout(20_000);

  test('stakeholder lists route has no contrast violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page, {
      email: `contrast-committee-lists-${Date.now()}@example.test`,
      roles: ['COMMITTEE_MEMBER'],
    });

    await resetStakeholders();
    await seedStakeholder({
      kind: 'INSTITUTION',
      fullName: 'Tech Amazonas SAC',
      ruc: '20123456789',
      sector: 'Software',
      position: 'Director TI',
      email: 'contacto@techamazonas.example.test',
      mobile: '987654321',
    });

    await waitForApi(page, '/stakeholder-lists', () => page.goto('/listas-constituyentes'));
    await expect(page.getByRole('button', { name: 'Crear lista' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'stakeholder-lists-empty-desktop' });

    await page.getByRole('button', { name: 'Crear lista' }).click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();
    await expectNoContrastViolations(page, { context: 'stakeholder-lists-create-dialog-desktop' });
    await page.setViewportSize(MOBILE);
    await expectNoContrastViolations(page, { context: 'stakeholder-lists-create-dialog-mobile' });
    await page.setViewportSize(DESKTOP);
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().endsWith('/stakeholder-lists') &&
          res.request().method() === 'POST' &&
          res.status() === 201,
      ),
      createDialog.getByRole('button', { name: 'Crear lista' }).click(),
    ]);

    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/stakeholders') &&
          res.request().method() === 'GET' &&
          res.status() === 200,
      ),
      page.getByRole('button', { name: 'Agregar constituyentes' }).click(),
    ]);
    await expect(
      page.getByRole('button', { name: 'Agregar Tech Amazonas SAC a la lista' }),
    ).toBeVisible();
    await expectNoContrastViolations(page, { context: 'stakeholder-lists-picker-desktop' });

    await page.getByRole('button', { name: 'Agregar Tech Amazonas SAC a la lista' }).click();
    await page.getByLabel(/Representante legal/i).fill('Carlos Mendoza');
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/members') &&
          res.request().method() === 'POST' &&
          res.status() === 201,
      ),
      page.getByRole('button', { name: 'Confirmar' }).click(),
    ]);

    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'Tech Amazonas SAC' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'stakeholder-lists-table-desktop' });

    await page.getByRole('button', { name: 'Copiar para nuevo año' }).click();
    await expect(page.getByRole('button', { name: 'Copiar lista' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'stakeholder-lists-copy-desktop' });
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await page.setViewportSize(MOBILE);
    await expect(page.getByRole('cell', { name: 'Tech Amazonas SAC' })).toBeVisible();
    await expectNoContrastViolations(page, { context: 'stakeholder-lists-table-mobile' });
  });
});
