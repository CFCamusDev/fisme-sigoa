import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { test, expect } from './support/test';
import { loginAsTestUser, seedUser } from './support/seed-user';
import { getWorkerSeeder } from './support/seeder';

function getApiUrl(): string {
  const apiUrl = process.env['E2E_API_URL'];
  if (!apiUrl) {
    throw new Error('Falta E2E_API_URL para las pruebas E2E.');
  }
  return apiUrl;
}

let executionCounter = 0;

function nextUniqueYear(): number {
  const raw = process.env['E2E_WORKER_INDEX'];
  const workerIndex = raw ? Number.parseInt(raw, 10) || 0 : 0;
  executionCounter += 1;
  return 2070 + (workerIndex % 5) * 6 + executionCounter;
}

async function withAuthenticatedApi<T>(
  credentials: { email: string; password: string },
  fn: (api: APIRequestContext, apiUrl: string) => Promise<T>,
): Promise<T> {
  const apiUrl = getApiUrl();
  const loginContext = await playwrightRequest.newContext();
  let accessToken: string | undefined;
  try {
    const loginRes = await loginContext.post(`${apiUrl}/auth/login`, {
      data: credentials,
    });
    if (!loginRes.ok()) {
      throw new Error(`POST ${apiUrl}/auth/login failed (${loginRes.status()})`);
    }
    const loginBody = (await loginRes.json()) as { accessToken?: string };
    accessToken = loginBody.accessToken;
    if (!accessToken) {
      throw new Error('POST /auth/login no devolvió accessToken');
    }
  } finally {
    await loginContext.dispose();
  }

  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  try {
    return await fn(api, apiUrl);
  } finally {
    await api.dispose();
  }
}

async function ensureApprovedCatalogVersionId(
  api: APIRequestContext,
  apiUrl: string,
): Promise<string> {
  let res = await api.get(`${apiUrl}/catalog-versions`);
  if (!res.ok()) {
    throw new Error(`GET ${apiUrl}/catalog-versions failed (${res.status()}): ${await res.text()}`);
  }
  let body = (await res.json()) as { items?: Array<{ id: string; status: string }> };
  let approved = body.items?.find((item) => item.status === 'APPROVED');

  if (!approved) {
    await getWorkerSeeder().seedCurrentCatalog();
    res = await api.get(`${apiUrl}/catalog-versions`);
    if (!res.ok()) {
      throw new Error(
        `GET ${apiUrl}/catalog-versions after seed failed (${res.status()}): ${await res.text()}`,
      );
    }
    body = (await res.json()) as { items?: Array<{ id: string; status: string }> };
    approved = body.items?.find((item) => item.status === 'APPROVED');
  }

  if (!approved) {
    throw new Error('No se encontró una versión de catálogo APPROVED para la prueba E2E.');
  }
  return approved.id;
}

async function createExecutionViaApi(credentials: {
  email: string;
  password: string;
}): Promise<{ id: string; name: string }> {
  return withAuthenticatedApi(credentials, async (api, apiUrl) => {
    const catalogVersionId = await ensureApprovedCatalogVersionId(api, apiUrl);
    const year = nextUniqueYear();
    const name = `Medición P612 ${year} E2E ${Date.now() % 100_000}`;

    const response = await api.post(`${apiUrl}/process-executions`, {
      data: {
        type: 'P612',
        year,
        catalogVersionId,
        name,
      },
    });
    if (response.status() !== 201) {
      throw new Error(
        `POST ${apiUrl}/process-executions failed (${response.status()}): ${await response.text()}`,
      );
    }
    return (await response.json()) as { id: string; name: string };
  });
}

test.describe('HU-081 — Correcciones de staging', () => {
  test.setTimeout(30_000);

  test('starts new execution without a selected process', async ({ page }) => {
    await loginAsTestUser(page, { roles: ['COMMITTEE_PRESIDENT'] });
    await page.goto('/ejecuciones');

    await page.getByRole('button', { name: /nueva ejecución/i }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: /nueva ejecución de proceso/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: /crear ejecución/i }).click();

    const alert = page.getByRole('alert').first();
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(/invalid enum|expected one of/i);
  });

  test('voids with a reason of at least ten characters and shows it on the board', async ({
    page,
  }) => {
    const creds = await loginAsTestUser(page, { roles: ['COMMITTEE_PRESIDENT'] });
    const execution = await createExecutionViaApi(creds);

    await page.goto(`/ejecuciones/${execution.id}`);
    await expect(page.getByRole('heading', { level: 1, name: execution.name })).toBeVisible();

    await page.getByRole('button', { name: /anular ejecución/i }).click();
    const reasonInput = page.getByLabel(/motivo de anulación/i);

    await reasonInput.fill('corto');
    await page.getByRole('button', { name: /confirmar anulación/i }).click();
    await expect(page.getByText(/al menos 10 caracteres/i)).toBeVisible();

    const validReason = 'Ejecución anulada durante verificación E2E';
    await reasonInput.fill(validReason);

    const [voidRes] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/process-executions/${execution.id}/void`) &&
          res.request().method() === 'POST',
      ),
      page.getByRole('button', { name: /confirmar anulación/i }).click(),
    ]);
    expect(voidRes.ok()).toBe(true);

    await expect(page.getByText(`Motivo de anulación: ${validReason}`)).toBeVisible();
    await expect(page.getByText('Anulado', { exact: true }).first()).toBeVisible();
  });

  test('locks the schedule of a voided execution', async ({ page }) => {
    const creds = await loginAsTestUser(page, { roles: ['COMMITTEE_PRESIDENT'] });
    const execution = await createExecutionViaApi(creds);

    await withAuthenticatedApi(creds, async (api, apiUrl) => {
      const voidRes = await api.post(`${apiUrl}/process-executions/${execution.id}/void`, {
        data: { reason: 'Anulada para verificar bloqueo del cronograma' },
      });
      expect(voidRes.ok()).toBe(true);
    });

    await page.goto(`/cronograma/${execution.id}`);
    await expect(
      page.getByText(/la ejecución está anulada; el cronograma es de solo lectura/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /guardar cronograma/i })).toHaveCount(0);
  });

  test('requires the meeting link for a hybrid session', async ({ page }) => {
    const creds = await loginAsTestUser(page, { roles: ['COMMITTEE_PRESIDENT'] });
    await createExecutionViaApi(creds);

    await page.goto('/sesiones');
    const newSessionBtn = page.getByRole('button', { name: /nueva sesión/i });
    await expect(newSessionBtn).toBeEnabled();
    await newSessionBtn.click();

    await page.getByLabel('Modalidad').selectOption('HYBRID');

    const meetingInput = page.getByLabel(/enlace de la reunión/i);
    await expect(meetingInput).toBeVisible();
    await expect(meetingInput).toHaveAttribute('aria-required', 'true');

    await page.getByRole('button', { name: /guardar sesión|registrar sesión/i }).click();
    await expect(page.getByText(/enlace de la reunión es obligatorio/i)).toBeVisible();
  });

  test('shows a readable dni error when editing a user', async ({ page }) => {
    await loginAsTestUser(page, { roles: ['ADMINISTRATOR'] });
    const suffix = Date.now() % 1_000_000;
    const dniA = String(70_000_000 + suffix);
    const dniB = String(80_000_000 + suffix);

    await seedUser({
      email: `dni-a-${suffix}@example.test`,
      names: 'Usuario',
      firstSurname: 'Primero',
      dni: dniA,
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });

    const userB = await seedUser({
      email: `dni-b-${suffix}@example.test`,
      names: 'Usuario',
      firstSurname: 'Segundo',
      dni: dniB,
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });

    await page.goto(`/usuarios/${userB.id}/editar`);
    const dniInput = page.getByLabel(/dni/i);
    await expect(dniInput).toHaveValue(dniB);

    await dniInput.fill(dniA);
    const [updateRes] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes(`/users/${userB.id}`) && res.request().method() === 'PATCH',
      ),
      page.getByRole('button', { name: /guardar cambios/i }).click(),
    ]);
    expect(updateRes.status()).toBe(409);

    await expect(page.getByText(/ya existe otro usuario con este dni registrado/i)).toBeVisible();
  });
});
