import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './support/seed-user';

test.describe('Health check and backend connectivity', () => {
  test('shows backend health on the dashboard', async ({ page }) => {
    await loginAsTestUser(page);

    await expect(page.getByRole('heading', { name: 'FISME-SIGOA' })).toBeVisible();
    await expect(page.getByText('Servidor operativo (OK)')).toBeVisible();
    await expect(page.getByText('Servicios de backend operativos (/health)')).toBeVisible();
    await expect(page.getByText(/Última comprobación:/i)).toBeVisible();
  });

  test('shows an error when the backend is unreachable', async ({ page }) => {
    await loginAsTestUser(page);

    await page.route('**/health', (route) => route.abort());

    await page.getByRole('button', { name: /comprobar estado/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(
      /Servidor no disponible o con errores|No se pudo conectar con el servidor/i,
    );
  });
});
