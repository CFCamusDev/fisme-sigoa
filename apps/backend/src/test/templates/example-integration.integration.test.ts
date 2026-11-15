/**
 * Plantilla copiable: prueba de integración rápida y aislada con PostgreSQL real.
 *
 * Cómo usarla:
 * 1. Copia este archivo como `*.integration.test.ts` en el módulo correspondiente.
 * 2. Usa siempre `useTestDatabase()` (base por worker, limpia entre pruebas) y
 *    `seedAuthorizationFast` en `beforeEach` (nunca `seedAuthorization` lenta).
 * 3. Crea los datos propios de cada caso sin depender del orden ni de otros archivos.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../db/use-test-database.js';
import { seedAuthorizationFast } from '../factories/authorization-fast.js';

describe('Template: integración aislada con PostgreSQL real', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  beforeEach(async () => {
    await seedAuthorizationFast(prisma);
  });

  it('seeds predefined roles in an isolated worker database', async () => {
    const rolesCount = await prisma.role.count();
    expect(rolesCount).toBeGreaterThanOrEqual(5);
  }, 30_000);
});
