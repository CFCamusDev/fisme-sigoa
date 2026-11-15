/**
 * Plantilla copiable: prueba E2E rápida con sesión por API y siembra en proceso.
 *
 * Cómo usarla:
 * 1. Copia este archivo en `apps/frontend/e2e/<feature>.spec.ts`.
 * 2. Importa `test` y `expect` desde `../support/test` (o `./support/test` en la raíz de `e2e/`).
 * 3. Usa `loginAsTestUser(page)` para reutilizar la cuenta del worker e iniciar sesión por API
 *    (no uses el formulario de login ni `execSync` ni `waitForTimeout`).
 */
import { test, expect } from '../support/test';
import { loginAsTestUser } from '../support/seed-user';

test.describe('Template: E2E con sesión del worker', () => {
  test.setTimeout(30_000);

  test('signs in via API with worker account and waits by signal', async ({ page }) => {
    await loginAsTestUser(page, { roles: ['ADMINISTRATOR'] });
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
  });
});
