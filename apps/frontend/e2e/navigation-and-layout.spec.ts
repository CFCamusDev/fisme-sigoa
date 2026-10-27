import { test, expect } from '@playwright/test';

test.describe('Navigation, layout accessibility and responsiveness', () => {
  test('navigates between the dashboard and the login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Iniciar sesión/i })).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'FISME-SIGOA' })).toBeVisible();
  });

  test('public survey route shows the token from the url', async ({ page }) => {
    await page.goto('/encuesta/demo-token-123');
    await expect(page.getByRole('heading', { name: /Encuesta institucional/i })).toBeVisible();
    await expect(page.getByText(/demo-token-123/i)).toBeVisible();
  });

  test('unknown route shows the Spanish not found page', async ({ page }) => {
    await page.goto('/esta-ruta-no-existe');
    await expect(page.getByRole('heading', { name: /Página no encontrada/i })).toBeVisible();
    await expect(page.getByText(/La ruta solicitada no existe o ha sido movida/i)).toBeVisible();
  });

  test('skip link moves focus to the main content', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /Saltar al contenido principal/i });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveAttribute('href', '#main-content');

    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('sidebar is fixed at desktop width and collapsible below 1024px', async ({ page }) => {
    // Modo Desktop (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const sidebar = page.locator('#app-sidebar');
    await expect(sidebar).toBeVisible();

    const menuToggle = page.getByRole('button', { name: /menú de navegación/i });
    await expect(menuToggle).toBeHidden();

    // Modo Pantalla Reducida / Móvil (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });

    await expect(menuToggle).toBeVisible();
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');

    // Abrir menú lateral
    await menuToggle.click();
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');

    const closeButton = page.getByRole('button', { name: /Cerrar barra lateral/i });
    await expect(closeButton).toBeVisible();

    // Cerrar mediante botón interno de la barra
    await closeButton.click();
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');

    // Abrir nuevamente y cerrar con la tecla Escape
    await menuToggle.click();
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
  });
});
