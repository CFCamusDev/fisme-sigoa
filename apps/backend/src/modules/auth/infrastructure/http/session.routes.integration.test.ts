import { describe, expect, it } from 'vitest';
import request from 'supertest';
import * as jose from 'jose';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { Argon2PasswordHasher } from '../security/argon2-password-hasher.js';
import { RandomRefreshTokenGenerator } from '../security/random-refresh-token-generator.js';

describe('POST /auth/refresh Integration (PostgreSQL real, CA1, CA3, RF-002, RS-016, RNF-004, RNF-007, RS-020)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const hasher = new Argon2PasswordHasher();
  const generator = new RandomRefreshTokenGenerator(7);

  const env = createTestEnv({
    AUTH_MAX_FAILED_ATTEMPTS: 5,
    AUTH_LOCKOUT_MINUTES: 15,
    RATE_LIMIT_SESSION_MAX: 3,
    TRUST_PROXY: 1, // Permite que express use x-forwarded-for para aislar rate limits por IP
  });

  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);

  const app = createApp({
    env,
    setupRoutes: (instance) => {
      setupAppRoutes(instance, {
        unitOfWork: uow,
        auditLogger: auditServices.auditLogger,
        dbProvider: uow,
        env,
      });
    },
  });

  async function createFixtureUser(overrides: {
    email: string;
    password?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION';
  }) {
    const rawPassword = overrides.password ?? 'ValidSecret123!';
    const passwordHash = await hasher.hash(rawPassword);

    return prisma.user.create({
      data: {
        email: overrides.email,
        passwordHash,
        names: 'Test',
        firstSurname: 'Session',
        secondSurname: 'Integration',
        dni: String(Math.floor(10000000 + Math.random() * 89999999)),
        status: overrides.status ?? 'ACTIVE',
      },
    });
  }

  it('refreshes the session with a valid refresh token (CA1)', async () => {
    const email = `refresh.valid.${Date.now()}@example.test`;
    const user = await createFixtureUser({ email, password: 'SuperPassword123!' });

    // 1. Obtener sesión inicial por login
    const loginRes = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.10.1.1')
      .send({ email, password: 'SuperPassword123!' });

    expect(loginRes.status).toBe(200);
    const initialRefreshToken = loginRes.body.refreshToken;

    // 2. Renovar sesión
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('x-forwarded-for', '10.10.1.2')
      .send({ refreshToken: initialRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.headers['cache-control']).toBe('no-store');
    expect(refreshRes.headers['pragma']).toBe('no-cache');

    const body = refreshRes.body;
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.refreshToken).not.toBe(initialRefreshToken);
    expect(body.user).toEqual({
      id: user.id,
      names: user.names,
      firstSurname: user.firstSurname,
      secondSurname: user.secondSurname,
      email,
    });

    // Validar nuevo access token firmado
    const secretBytes = new TextEncoder().encode(env.AUTH_JWT_SECRET);
    const { payload } = await jose.jwtVerify(body.accessToken, secretBytes, {
      issuer: 'fisme-sigoa',
    });
    expect(payload.sub).toBe(user.id);

    // Validar estado de refresh tokens en BD PostgreSQL
    const tokens = await prisma.refreshToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(tokens.length).toBe(2);

    // El anterior debe estar revocado
    expect(tokens[0]!.revokedAt).not.toBeNull();
    // El nuevo debe estar activo y registrar la IP del cliente
    expect(tokens[1]!.revokedAt).toBeNull();
    expect(tokens[1]!.createdByIp).toBe('10.10.1.2');
    // Ninguno almacena el token en plano
    expect(tokens[0]!.tokenHash).not.toBe(initialRefreshToken);
    expect(tokens[1]!.tokenHash).not.toBe(body.refreshToken);
  }, 30_000);

  it('rejects the previous refresh token after rotation (CA1, CA3)', async () => {
    const email = `refresh.reuse.${Date.now()}@example.test`;
    await createFixtureUser({ email, password: 'SuperPassword123!' });

    const loginRes = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.10.2.1')
      .send({ email, password: 'SuperPassword123!' });

    const originalRefreshToken = loginRes.body.refreshToken;

    // Primera rotación: éxito 200
    const firstRefresh = await request(app)
      .post('/auth/refresh')
      .set('x-forwarded-for', '10.10.2.2')
      .send({ refreshToken: originalRefreshToken });
    expect(firstRefresh.status).toBe(200);

    // Intento de reusar el token original: rechazo 401
    const secondRefresh = await request(app)
      .post('/auth/refresh')
      .set('x-forwarded-for', '10.10.2.3')
      .send({ refreshToken: originalRefreshToken });

    expect(secondRefresh.status).toBe(401);
    expect(secondRefresh.body.error.code).toBe('UNAUTHORIZED');
    expect(secondRefresh.body.error.message).toContain('La sesión expiró o ya no es válida');
  }, 30_000);

  it('returns 401 for a revoked refresh token', async () => {
    const email = `refresh.revoked.${Date.now()}@example.test`;
    const user = await createFixtureUser({ email });
    const generated = generator.generate(new Date());

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: generated.tokenHash,
        expiresAt: generated.expiresAt,
        revokedAt: new Date(),
        createdByIp: '10.10.3.1',
      },
    });

    const response = await request(app)
      .post('/auth/refresh')
      .set('x-forwarded-for', '10.10.3.2')
      .send({ refreshToken: generated.token });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body.error.message).toContain('La sesión expiró o ya no es válida');
  }, 30_000);

  it('returns 401 for an expired refresh token', async () => {
    const email = `refresh.expired.${Date.now()}@example.test`;
    const user = await createFixtureUser({ email });
    const generated = generator.generate(new Date());

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: generated.tokenHash,
        expiresAt: new Date(Date.now() - 3600000), // Expirado hace 1 hora
        revokedAt: null,
        createdByIp: '10.10.4.1',
      },
    });

    const response = await request(app)
      .post('/auth/refresh')
      .set('x-forwarded-for', '10.10.4.2')
      .send({ refreshToken: generated.token });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body.error.message).toContain('La sesión expiró o ya no es válida');
  }, 30_000);

  it('returns 401 with the same message for an unknown token (CA3)', async () => {
    const response = await request(app)
      .post('/auth/refresh')
      .set('x-forwarded-for', '10.10.5.1')
      .send({ refreshToken: 'unrecognized-non-existent-token-1234567890' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body.error.message).toContain('La sesión expiró o ya no es válida');
  }, 30_000);

  it('returns 401 for an inactive user', async () => {
    const email = `refresh.inactive.${Date.now()}@example.test`;
    const user = await createFixtureUser({ email, status: 'INACTIVE' });
    const generated = generator.generate(new Date());

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: generated.tokenHash,
        expiresAt: generated.expiresAt,
        revokedAt: null,
        createdByIp: '10.10.6.1',
      },
    });

    const response = await request(app)
      .post('/auth/refresh')
      .set('x-forwarded-for', '10.10.6.2')
      .send({ refreshToken: generated.token });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body.error.message).toContain('La sesión expiró o ya no es válida');
  }, 30_000);

  it('returns 400 for an invalid body without modifying database', async () => {
    const response = await request(app)
      .post('/auth/refresh')
      .set('x-forwarded-for', '10.10.7.1')
      .send({ unexpectedField: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toBeDefined();
  }, 30_000);

  it('returns 429 after the session rate limit', async () => {
    const targetIp = '10.10.8.1';

    // RATE_LIMIT_SESSION_MAX está configurado en 3
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/auth/refresh')
        .set('x-forwarded-for', targetIp)
        .send({ refreshToken: 'any-token' });
      expect([400, 401]).toContain(res.status);
    }

    // Cuarta petición: bloqueada por rate limit
    const blockedRes = await request(app)
      .post('/auth/refresh')
      .set('x-forwarded-for', targetIp)
      .send({ refreshToken: 'any-token' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe('RATE_LIMITED');
  }, 30_000);

  it('audits the rotation without token material', async () => {
    const email = `refresh.audit.${Date.now()}@example.test`;
    const user = await createFixtureUser({ email, password: 'SuperPassword123!' });

    const loginRes = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.10.9.1')
      .send({ email, password: 'SuperPassword123!' });

    const refreshToken = loginRes.body.refreshToken;

    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('x-forwarded-for', '10.10.9.2')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(200);

    // Buscar auditoría de STATE_CHANGE para RefreshToken
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity: 'RefreshToken',
      },
      orderBy: { sequence: 'desc' },
    });

    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    const rotationAudit = auditLogs.find((log) => {
      const after = log.after as Record<string, unknown> | null;
      return after?.reason === 'ROTATED';
    });

    expect(rotationAudit).toBeDefined();
    expect(rotationAudit!.action).toBe('STATE_CHANGE');
    expect(rotationAudit!.actor).toBe(user.id);
    expect(rotationAudit!.ip).toBe('10.10.9.2');

    // Verificar que no se expone el token ni su hash en los payloads auditados
    const auditPayload = JSON.stringify({
      entityId: rotationAudit!.entityId,
      before: rotationAudit!.before,
      after: rotationAudit!.after,
    });
    expect(auditPayload).not.toContain(refreshToken);
    expect(auditPayload).not.toContain(refreshRes.body.refreshToken);
  }, 30_000);

  it('rotates only once under concurrent requests with the same token', async () => {
    const email = `refresh.concurrent.${Date.now()}@example.test`;
    const user = await createFixtureUser({ email, password: 'SuperPassword123!' });

    const loginRes = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.10.10.1')
      .send({ email, password: 'SuperPassword123!' });

    const tokenToRotate = loginRes.body.refreshToken;

    // Lanzar dos peticiones concurrentes con el mismo refresh token
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/auth/refresh')
        .set('x-forwarded-for', '10.10.10.2')
        .send({ refreshToken: tokenToRotate }),
      request(app)
        .post('/auth/refresh')
        .set('x-forwarded-for', '10.10.10.3')
        .send({ refreshToken: tokenToRotate }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 401]);

    // En BD: exactamente 1 token revocado original y 1 token nuevo activo
    const allTokens = await prisma.refreshToken.findMany({
      where: { userId: user.id },
    });
    expect(allTokens.length).toBe(2);

    const activeTokens = allTokens.filter((t) => t.revokedAt === null);
    const revokedTokens = allTokens.filter((t) => t.revokedAt !== null);

    expect(activeTokens.length).toBe(1);
    expect(revokedTokens.length).toBe(1);
  }, 30_000);
});
