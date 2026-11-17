import { test, expect } from './support/test';
import { waitForApi } from './support/contrast';
import { loginAsTestUser } from './support/seed-user';
import { resetStakeholders, seedStakeholder } from './support/stakeholder-data';

test.describe('Stakeholder Lists Flow (HU-022, T-022-29, CA1, CA2, CA3)', () => {
  test.setTimeout(20_000);

  test('member builds the employers 2027 list and copies it to 2028', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await loginAsTestUser(page, {
      email: `e2e-committee-lists-${Date.now()}@example.test`,
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
    await seedStakeholder({
      kind: 'INSTITUTION',
      fullName: 'Empresa Sin Sector SAC',
      ruc: '20987654321',
      sector: null,
      position: 'Gerente',
      email: 'sinsector@example.test',
      mobile: '987654322',
    });

    await waitForApi(page, '/stakeholder-lists', () => page.goto('/listas-constituyentes'));
    await expect(page.getByRole('heading', { level: 1, name: 'Listas del Anexo 3' })).toBeVisible();

    const yearInput = page.getByLabel(/^Año$/i);
    await yearInput.fill('2027');
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/stakeholder-lists') &&
          res.url().includes('year=2027') &&
          res.request().method() === 'GET' &&
          res.status() === 200,
      ),
      page.getByRole('button', { name: 'Ver lista' }).click(),
    ]);

    await page.getByLabel(/N\.° de plan de estudios/i).fill('2024-II');
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().endsWith('/stakeholder-lists') &&
          res.request().method() === 'POST' &&
          res.status() === 201,
      ),
      page.getByRole('button', { name: 'Crear lista' }).click(),
    ]);

    await expect(page.getByRole('status')).toContainText('creada correctamente');

    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/stakeholders') &&
          res.request().method() === 'GET' &&
          res.status() === 200,
      ),
      page.getByRole('button', { name: 'Agregar constituyentes' }).click(),
    ]);

    // Intento con empleador sin sector -> muestra campo faltante (CA2)
    await page.getByRole('button', { name: 'Agregar Empresa Sin Sector SAC a la lista' }).click();
    await page.getByLabel(/Representante legal/i).fill('Luis Diaz');
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/members') &&
          res.request().method() === 'POST' &&
          res.status() === 400,
      ),
      page.getByRole('button', { name: 'Confirmar' }).click(),
    ]);
    await expect(page.getByRole('alert')).toContainText('Sector');
    await expect(page.getByRole('link', { name: 'Completar el registro' })).toHaveAttribute(
      'href',
      '/constituyentes',
    );
    await page.getByRole('button', { name: 'Cancelar' }).click();

    // Agregar empleador completo (CA1)
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

    await page.getByRole('button', { name: 'Cerrar selector' }).click();
    await expect(page.getByRole('cell', { name: 'Tech Amazonas SAC' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '20123456789' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Carlos Mendoza' })).toBeVisible();

    // Copiar para nuevo año 2028 (CA3)
    await page.getByRole('button', { name: 'Copiar para nuevo año' }).click();
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/copy') && res.request().method() === 'POST' && res.status() === 201,
      ),
      page.getByRole('button', { name: 'Copiar lista' }).click(),
    ]);

    await expect(page.getByRole('status')).toContainText('Se copiaron 1 miembros a la lista 2028');
    expect(pageErrors).toEqual([]);
  });
});
