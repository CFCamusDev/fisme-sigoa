import { test, expect } from '@playwright/test';

test.describe('Health check and backend connectivity', () => {
  test('shows backend health on the dashboard', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'FISME-SIGOA' })).toBeVisible();
    await expect(page.getByText('Servidor operativo (OK)')).toBeVisible();
    await expect(page.getByText('Servicios de backend operativos (/health)')).toBeVisible();
    await expect(page.getByText(/Última comprobación:/i)).toBeVisible();
  });

  test('shows an error when the backend is unreachable', async ({ page }) => {
    await page.route('**/health', (route) => route.abort());

    await page.goto('/');

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(
      /Servidor no disponible o con errores|No se pudo conectar con el servidor/i,
    );
  });
});
