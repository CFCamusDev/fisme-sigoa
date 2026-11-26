import { test, expect } from './support/test';
import { DESKTOP, MOBILE, expectNoContrastViolations, waitForApi } from './support/contrast';
import { loginAsTestUser } from './support/seed-user';
import {
  buildStakeholderImportFile,
  resetStakeholders,
  seedStakeholder,
} from './support/stakeholder-data';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function openCreatedEmployersList2027(page: import('@playwright/test').Page) {
  await waitForApi(page, '/stakeholder-lists', () => page.goto('/listas-constituyentes'));
  await expect(page.getByRole('heading', { level: 1, name: 'Listas del Anexo 3' })).toBeVisible();

  await page.getByLabel(/^Año$/i).fill('2027');
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

  await page.getByRole('button', { name: 'Crear lista' }).click();
  const createDialog = page.getByRole('dialog');
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel(/N\.° de plan de estudios/i).fill('2024-II');
  await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().endsWith('/stakeholder-lists') &&
        res.request().method() === 'POST' &&
        res.status() === 201,
    ),
    createDialog.getByRole('button', { name: 'Crear lista' }).click(),
  ]);

  await expect(page.getByRole('status')).toContainText('creada correctamente');
}

test.describe('Stakeholder Import E2E Flow (HU-023, T-023-19, CA1, CA2, CA3)', () => {
  test.setTimeout(20_000);

  test('member previews an Excel file with valid and invalid rows', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page, {
      email: `e2e-import-preview-${Date.now()}@example.test`,
      roles: ['COMMITTEE_MEMBER'],
    });
    await resetStakeholders();
    await openCreatedEmployersList2027(page);

    await page.getByRole('button', { name: 'Importar desde Excel' }).click();
    await expectNoContrastViolations(page, 'asistente-importar-paso-1-desktop');

    const buffer = await buildStakeholderImportFile({
      listType: 'EMPLOYER',
      rows: [
        [
          '20111111111',
          'Nueva Empresa E2E SAC',
          'Software',
          'Carlos Mendoza',
          'empresa@example.test',
          '987654321',
          'Gerente',
        ],
        ['123', 'Fila Invalida', 'Software', 'Ana', 'bad@example.test', '987654322', 'Jefe'],
      ],
    });

    await page.getByLabel(/Archivo Excel \(\.xlsx\)/i).setInputFiles({
      name: 'empleadores.xlsx',
      mimeType: XLSX_MIME,
      buffer,
    });

    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/import/preview') &&
          res.request().method() === 'POST' &&
          res.status() === 200,
      ),
      page.getByRole('button', { name: 'Ver vista previa' }).click(),
    ]);

    await expect(
      page.getByRole('heading', {
        name: /2 filas: 1 nuevas, 0 ya registradas, 0 ya en la lista, 1 con errores/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Nueva Empresa E2E SAC' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Fila Invalida' })).toBeVisible();
    await expectNoContrastViolations(page, 'asistente-importar-vista-previa-desktop');

    await page.setViewportSize(MOBILE);
    await expectNoContrastViolations(page, 'asistente-importar-vista-previa-mobile');

    expect(pageErrors).toEqual([]);
  });

  test('confirming reuses the master record and creates only the new ones', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await loginAsTestUser(page, {
      email: `e2e-import-confirm-${Date.now()}@example.test`,
      roles: ['COMMITTEE_MEMBER'],
    });
    await resetStakeholders();
    await seedStakeholder({
      kind: 'INSTITUTION',
      fullName: 'Tech Amazonas SAC',
      ruc: '20123456789',
      sector: 'Tecnologia',
      position: 'Gerente General',
      email: 'contacto@techamazonas.example.test',
      mobile: '987654321',
    });

    await openCreatedEmployersList2027(page);
    await page.getByRole('button', { name: 'Importar desde Excel' }).click();

    const buffer = await buildStakeholderImportFile({
      listType: 'EMPLOYER',
      rows: [
        [
          '20123456789',
          'Nombre Ignorado',
          'Otro Sector',
          'Carlos Mendoza',
          'otro@example.test',
          '911111111',
          'Director',
        ],
        [
          '20222222222',
          'Andes Digital SAC',
          'Servicios',
          'Lucia Perez',
          'andes@example.test',
          '987654323',
          'Gerente',
        ],
      ],
    });

    await page.getByLabel(/Archivo Excel \(\.xlsx\)/i).setInputFiles({
      name: 'confirmar.xlsx',
      mimeType: XLSX_MIME,
      buffer,
    });

    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/import/preview') &&
          res.request().method() === 'POST' &&
          res.status() === 200,
      ),
      page.getByRole('button', { name: 'Ver vista previa' }).click(),
    ]);

    await page.getByRole('button', { name: 'Continuar' }).click();

    const [confirmResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/import/confirm') &&
          res.request().method() === 'POST' &&
          res.status() === 201,
      ),
      page.getByRole('button', { name: 'Confirmar importación' }).click(),
    ]);

    const confirmBody = (await confirmResponse.json()) as {
      totals: { created: number; reused: number; added: number };
    };
    expect(confirmBody.totals).toMatchObject({ created: 1, reused: 1, added: 2 });

    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Importación completada: 1 creados, 1 reutilizados, 2 agregados' }),
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Tech Amazonas SAC' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Andes Digital SAC' })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('cancelling the preview saves nothing', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    let confirmRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('/import/confirm') && req.method() === 'POST') {
        confirmRequests += 1;
      }
    });

    await loginAsTestUser(page, {
      email: `e2e-import-cancel-${Date.now()}@example.test`,
      roles: ['COMMITTEE_MEMBER'],
    });
    await resetStakeholders();
    await openCreatedEmployersList2027(page);

    await page.getByRole('button', { name: 'Importar desde Excel' }).click();
    const buffer = await buildStakeholderImportFile({
      listType: 'EMPLOYER',
      rows: [
        [
          '20333333333',
          'Empresa Cancelada SAC',
          'Comercio',
          'Rosa Diaz',
          'cancelada@example.test',
          '987654324',
          'Jefe',
        ],
      ],
    });

    await page.getByLabel(/Archivo Excel \(\.xlsx\)/i).setInputFiles({
      name: 'cancelar.xlsx',
      mimeType: XLSX_MIME,
      buffer,
    });

    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/import/preview') &&
          res.request().method() === 'POST' &&
          res.status() === 200,
      ),
      page.getByRole('button', { name: 'Ver vista previa' }).click(),
    ]);

    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('La lista aún no tiene miembros')).toBeVisible();
    expect(confirmRequests).toBe(0);
    expect(pageErrors).toEqual([]);
  });

  test('downloads the template of the list type', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await loginAsTestUser(page, {
      email: `e2e-import-template-${Date.now()}@example.test`,
      roles: ['COMMITTEE_MEMBER'],
    });
    await resetStakeholders();
    await openCreatedEmployersList2027(page);

    await page.getByRole('button', { name: 'Importar desde Excel' }).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar plantilla' }).click(),
    ]);

    expect(download.suggestedFilename()).toBe('plantilla-employer.xlsx');
    expect(pageErrors).toEqual([]);
  });
});
