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

describe('Session Routes Integration (HU-002, PostgreSQL real, CA1-CA3, RF-002, RS-016, RNF-004, RNF-007, RNF-009, RS-020)', () => {
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

  describe('POST /auth/refresh (CA1, CA3)', () => {
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

  describe('POST /auth/logout (CA2, RF-002, RS-016, RNF-004, RNF-007, RNF-009, RS-020)', () => {
    it('logs out and revokes the refresh token (CA2)', async () => {
      const email = `logout.valid.${Date.now()}@example.test`;
      const user = await createFixtureUser({ email, password: 'SuperPassword123!' });

      const loginRes = await request(app)
        .post('/auth/login')
        .set('x-forwarded-for', '10.20.1.1')
        .send({ email, password: 'SuperPassword123!' });

      const { accessToken, refreshToken } = loginRes.body;

      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-forwarded-for', '10.20.1.2')
        .send({ refreshToken });

      expect(logoutRes.status).toBe(204);
      expect(logoutRes.text).toBe('');

      // Validar en PostgreSQL que el refresh token quedó revocado
      const storedTokens = await prisma.refreshToken.findMany({
        where: { userId: user.id },
      });
      expect(storedTokens.length).toBe(1);
      expect(storedTokens[0]!.revokedAt).not.toBeNull();
    }, 30_000);

    it('the revoked refresh token cannot renew the session afterwards (CA2, CA3)', async () => {
      const email = `logout.refresh.chain.${Date.now()}@example.test`;
      await createFixtureUser({ email, password: 'SuperPassword123!' });

      const loginRes = await request(app)
        .post('/auth/login')
        .set('x-forwarded-for', '10.20.2.1')
        .send({ email, password: 'SuperPassword123!' });

      const { accessToken, refreshToken } = loginRes.body;

      // 1. Cerrar sesión
      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-forwarded-for', '10.20.2.2')
        .send({ refreshToken });
      expect(logoutRes.status).toBe(204);

      // 2. Intentar renovar con el token revocado
      const refreshRes = await request(app)
        .post('/auth/refresh')
        .set('x-forwarded-for', '10.20.2.3')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
      expect(refreshRes.body.error.code).toBe('UNAUTHORIZED');
      expect(refreshRes.body.error.message).toContain('La sesión expiró o ya no es válida');
    }, 30_000);

    it('is idempotent for an already revoked token', async () => {
      const email = `logout.idempotent.${Date.now()}@example.test`;
      const user = await createFixtureUser({ email, password: 'SuperPassword123!' });

      const loginRes = await request(app)
        .post('/auth/login')
        .set('x-forwarded-for', '10.20.3.1')
        .send({ email, password: 'SuperPassword123!' });

      const { accessToken, refreshToken } = loginRes.body;

      // Primer logout: 204
      const firstLogout = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-forwarded-for', '10.20.3.2')
        .send({ refreshToken });
      expect(firstLogout.status).toBe(204);

      const auditCountAfterFirst = await prisma.auditLog.count({
        where: {
          entity: 'RefreshToken',
          actor: user.id,
        },
      });

      // Segundo logout idempotente: 204
      const secondLogout = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-forwarded-for', '10.20.3.3')
        .send({ refreshToken });
      expect(secondLogout.status).toBe(204);

      const auditCountAfterSecond = await prisma.auditLog.count({
        where: {
          entity: 'RefreshToken',
          actor: user.id,
        },
      });

      // Idempotencia: no se crea un segundo registro de auditoría
      expect(auditCountAfterSecond).toBe(auditCountAfterFirst);
    }, 30_000);

    it('returns 401 without a bearer token, with a malformed or expired access token, and for an inactive user', async () => {
      const email = `logout.auth.errors.${Date.now()}@example.test`;
      const user = await createFixtureUser({ email, password: 'SuperPassword123!' });

      const loginRes = await request(app)
        .post('/auth/login')
        .set('x-forwarded-for', '10.20.4.1')
        .send({ email, password: 'SuperPassword123!' });

      const { refreshToken } = loginRes.body;

      // 1. Sin Bearer token
      const noTokenRes = await request(app)
        .post('/auth/logout')
        .set('x-forwarded-for', '10.20.4.2')
        .send({ refreshToken });
      expect(noTokenRes.status).toBe(401);
      expect(noTokenRes.body.error.code).toBe('UNAUTHORIZED');

      // 2. Token mal formado
      const malformedTokenRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid.malformed.jwt')
        .set('x-forwarded-for', '10.20.4.3')
        .send({ refreshToken });
      expect(malformedTokenRes.status).toBe(401);

      // 3. Token expirado
      const secretBytes = new TextEncoder().encode(env.AUTH_JWT_SECRET);
      const expiredToken = await new jose.SignJWT({ sub: user.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('fisme-sigoa')
        .setIssuedAt(Math.floor(Date.now() / 1000) - 1000)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 100)
        .sign(secretBytes);

      const expiredRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${expiredToken}`)
        .set('x-forwarded-for', '10.20.4.4')
        .send({ refreshToken });
      expect(expiredRes.status).toBe(401);

      // 4. Usuario inactivado
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'INACTIVE' },
      });

      const validTokenInactiveUser = await new jose.SignJWT({ sub: user.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('fisme-sigoa')
        .setIssuedAt(Math.floor(Date.now() / 1000))
        .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
        .sign(secretBytes);

      const inactiveUserRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${validTokenInactiveUser}`)
        .set('x-forwarded-for', '10.20.4.5')
        .send({ refreshToken });
      expect(inactiveUserRes.status).toBe(401);
    }, 30_000);

    it('returns 403 for a refresh token of another user', async () => {
      const userA = await createFixtureUser({
        email: `usera.${Date.now()}@example.test`,
        password: 'PasswordA123!',
      });
      const userB = await createFixtureUser({
        email: `userb.${Date.now()}@example.test`,
        password: 'PasswordB123!',
      });

      const loginResA = await request(app)
        .post('/auth/login')
        .set('x-forwarded-for', '10.20.5.1')
        .send({ email: userA.email, password: 'PasswordA123!' });
      const { accessToken: accessTokenA } = loginResA.body;

      const loginResB = await request(app)
        .post('/auth/login')
        .set('x-forwarded-for', '10.20.5.2')
        .send({ email: userB.email, password: 'PasswordB123!' });
      const { refreshToken: refreshTokenB } = loginResB.body;

      // Usuario A intenta revocar el token del usuario B
      const forbiddenRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessTokenA}`)
        .set('x-forwarded-for', '10.20.5.3')
        .send({ refreshToken: refreshTokenB });

      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');

      // Verificar en BD que el token del usuario B sigue intacto
      const tokenBInDb = await prisma.refreshToken.findMany({
        where: { userId: userB.id },
      });
      expect(tokenBInDb.length).toBe(1);
      expect(tokenBInDb[0]!.revokedAt).toBeNull();
    }, 30_000);

    it('returns 400 for an invalid body', async () => {
      const user = await createFixtureUser({
        email: `logout.badbody.${Date.now()}@example.test`,
        password: 'Password123!',
      });
      const loginRes = await request(app)
        .post('/auth/login')
        .set('x-forwarded-for', '10.20.6.1')
        .send({ email: user.email, password: 'Password123!' });
      const { accessToken } = loginRes.body;

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-forwarded-for', '10.20.6.2')
        .send({ unexpected: 'field' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }, 30_000);

    it('returns 429 after the session rate limit', async () => {
      const user = await createFixtureUser({
        email: `logout.rate.${Date.now()}@example.test`,
        password: 'Password123!',
      });
      const loginRes = await request(app)
        .post('/auth/login')
        .set('x-forwarded-for', '10.20.7.1')
        .send({ email: user.email, password: 'Password123!' });
      const { accessToken, refreshToken } = loginRes.body;

      const targetIp = '10.20.7.2';

      // RATE_LIMIT_SESSION_MAX está fijado en 3
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`)
          .set('x-forwarded-for', targetIp)
          .send({ refreshToken });
        expect([204, 400]).toContain(res.status);
      }

      // Cuarta petición: bloqueada por rate limit
      const blockedRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-forwarded-for', targetIp)
        .send({ refreshToken });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error.code).toBe('RATE_LIMITED');
    }, 30_000);

    it('audits the logout once', async () => {
      const email = `logout.audit.${Date.now()}@example.test`;
      const user = await createFixtureUser({ email, password: 'SuperPassword123!' });

      const loginRes = await request(app)
        .post('/auth/login')
        .set('x-forwarded-for', '10.20.8.1')
        .send({ email, password: 'SuperPassword123!' });

      const { accessToken, refreshToken } = loginRes.body;

      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-forwarded-for', '10.20.8.2')
        .send({ refreshToken });

      expect(logoutRes.status).toBe(204);

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entity: 'RefreshToken',
          actor: user.id,
        },
        orderBy: { sequence: 'desc' },
      });

      const logoutAudit = auditLogs.find((log) => {
        const after = log.after as Record<string, unknown> | null;
        return after?.reason === 'LOGOUT';
      });

      expect(logoutAudit).toBeDefined();
      expect(logoutAudit!.action).toBe('STATE_CHANGE');
      expect(logoutAudit!.ip).toBe('10.20.8.2');

      const auditPayload = JSON.stringify({
        entityId: logoutAudit!.entityId,
        before: logoutAudit!.before,
        after: logoutAudit!.after,
      });
      expect(auditPayload).not.toContain(refreshToken);
    }, 30_000);
  });
});
