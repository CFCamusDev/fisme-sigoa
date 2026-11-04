import { test, expect } from '@playwright/test';
import { expectNoContrastViolations } from './support/contrast';

test.describe('expectNoContrastViolations helper (T-002-21)', () => {
  test('passes for a valid pair with high contrast (black on white)', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="es">
        <head><title>Test</title></head>
        <body style="background-color: #ffffff; margin: 0; padding: 20px;">
          <h1 style="color: #000000; font-size: 24px;">Título con alto contraste</h1>
          <p style="color: #111827; font-size: 16px;">Texto con contraste adecuado.</p>
        </body>
      </html>
    `);

    await expect(expectNoContrastViolations(page, { screen: 'Válido' })).resolves.toBeUndefined();
  });

  test('fails for light text on a light background and reports the selector and details', async ({
    page,
  }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="es">
        <head><title>Test</title></head>
        <body style="background-color: #ffffff; margin: 0; padding: 20px;">
          <p id="low-contrast-text" style="color: #e2e8f0; font-size: 14px;">Texto casi invisible</p>
        </body>
      </html>
    `);

    let caughtError: Error | null = null;
    try {
      await expectNoContrastViolations(page, { screen: 'Pantalla de prueba' });
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain('Pantalla de prueba');
    expect(caughtError?.message).toContain('#low-contrast-text');
    expect(caughtError?.message).toContain('WCAG 2.1 AA');
  });

  test('reports the screen name in the error message', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="es">
        <head><title>Test</title></head>
        <body style="background-color: #f8fafc; padding: 20px;">
          <span style="color: #cbd5e1;">Texto ilegible</span>
        </body>
      </html>
    `);

    await expect(expectNoContrastViolations(page, { screen: 'Panel de Reportes' })).rejects.toThrow(
      /Panel de Reportes/,
    );
  });

  test('annotates incomplete results without failing by default', async ({ page }) => {
    // Texto sobre imagen de fondo sin color de fondo fallback genera resultado incompleto en axe
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="es">
        <head><title>Test</title></head>
        <body style="margin: 0; padding: 20px;">
          <div style="background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>');">
            <p style="color: #1e3a8a;">Texto sobre imagen de fondo</p>
          </div>
        </body>
      </html>
    `);

    // No debe lanzar error por defecto
    await expect(
      expectNoContrastViolations(page, { screen: 'Degradado/Imagen' }),
    ).resolves.toBeUndefined();
  });

  test('fails on incomplete results when failOnIncomplete is set', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="es">
        <head><title>Test</title></head>
        <body style="margin: 0; padding: 20px;">
          <div style="background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>');">
            <p id="complex-bg-text" style="color: #1e3a8a;">Texto con fondo complejo</p>
          </div>
        </body>
      </html>
    `);

    await expect(
      expectNoContrastViolations(page, { screen: 'Fondo complejo', failOnIncomplete: true }),
    ).rejects.toThrow(/contraste indeterminado.*Fondo complejo/);
  });
});
