import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { useTestDatabase } from './test/db/use-test-database.js';

describe('App Integration (with test database)', () => {
  const { testEnv, getPrisma } = useTestDatabase();

  it('responds with 200 OK on GET /health and verifies database connectivity with Prisma', async () => {
    const app = createApp({ env: testEnv });

    // 1. Verificación de la API HTTP con Supertest
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });

    // 2. Verificación de conectividad real con la base de datos de pruebas vía Prisma
    const prisma = getPrisma();
    const dbResult = await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 as result;`;

    expect(dbResult).toBeDefined();
    expect(dbResult.length).toBe(1);
    expect(dbResult[0]?.result).toBe(1);
  });
});
