import { test, expect } from './support/test';
import { DESKTOP, MOBILE, expectNoContrastViolations, waitForApi } from './support/contrast';
import { loginAsTestUser } from './support/seed-user';

test.describe('Color Contrast Accessibility (WCAG 2.1 AA) — Settings', () => {
  test.setTimeout(120_000);

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
});
