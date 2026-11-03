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

describe('POST /auth/login Integration (PostgreSQL real, CA1-CA4, RNF-004, RNF-007, RS-020)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const hasher = new Argon2PasswordHasher();

  const env = createTestEnv({
    AUTH_MAX_FAILED_ATTEMPTS: 5,
    AUTH_LOCKOUT_MINUTES: 15,
    RATE_LIMIT_LOGIN_MAX: 10,
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
    failedLoginAttempts?: number;
    lockedUntil?: Date | null;
  }) {
    const rawPassword = overrides.password ?? 'ValidSecret123!';
    const passwordHash = await hasher.hash(rawPassword);

    return prisma.user.create({
      data: {
        email: overrides.email,
        passwordHash,
        names: 'Test',
        firstSurname: 'User',
        secondSurname: 'Integration',
        dni: String(Math.floor(10000000 + Math.random() * 89999999)),
        status: overrides.status ?? 'ACTIVE',
        failedLoginAttempts: overrides.failedLoginAttempts ?? 0,
        lockedUntil: overrides.lockedUntil ?? null,
      },
    });
  }

  it('logs in with valid credentials, issuing access (15m) and refresh (7d) tokens (CA1)', async () => {
    const email = `active.login.${Date.now()}@example.test`;
    const user = await createFixtureUser({ email, password: 'MySuperPassword123!' });

    const response = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.0.1.1')
      .send({
        email: email.toUpperCase(), // Verifica normalización a minúsculas
        password: 'MySuperPassword123!',
      });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['pragma']).toBe('no-cache');

    const body = response.body;
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeUndefined();
    expect(response.headers['set-cookie']).toBeDefined();
    const setCookieHeader = response.headers['set-cookie']![0] ?? '';
    expect(setCookieHeader).toContain('sigoa_refresh_token=');
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('Path=/auth');
    expect(setCookieHeader).toContain('SameSite=Strict');
    expect(body.user).toEqual({
      id: user.id,
      names: user.names,
      firstSurname: user.firstSurname,
      secondSurname: user.secondSurname,
      email,
    });

    // Validar JWT
    const secretBytes = new TextEncoder().encode(env.AUTH_JWT_SECRET);
    const { payload } = await jose.jwtVerify(body.accessToken, secretBytes, {
      issuer: 'fisme-sigoa',
    });
    expect(payload.sub).toBe(user.id);

    // Validar que en BD solo se guardó el hash del refresh token
    const storedTokens = await prisma.refreshToken.findMany({
      where: { userId: user.id },
    });
    expect(storedTokens.length).toBe(1);
    expect(storedTokens[0]!.tokenHash).toBeDefined();
    expect(storedTokens[0]!.createdByIp).toBe('10.0.1.1');

    // Validar que lastLoginAt se actualizó
    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.lastLoginAt).not.toBeNull();
    expect(updatedUser.failedLoginAttempts).toBe(0);
  }, 30_000);

  it('rejects login with 403 when origin header does not match CORS_ORIGIN', async () => {
    const email = `origin.forbidden.${Date.now()}@example.test`;
    await createFixtureUser({ email, password: 'SuperPassword123!' });

    const response = await request(app)
      .post('/auth/login')
      .set('Origin', 'http://malicious-site.example')
      .send({
        email,
        password: 'SuperPassword123!',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects invalid credentials without indicating whether email or password was wrong (CA2)', async () => {
    const email = `wrong.pwd.${Date.now()}@example.test`;
    await createFixtureUser({ email, password: 'RealPassword123!' });

    // 1. Contraseña errónea
    const resWrongPwd = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.0.2.1')
      .send({
        email,
        password: 'IncorrectPassword!',
      });

    expect(resWrongPwd.status).toBe(401);
    expect(resWrongPwd.body.error.code).toBe('UNAUTHORIZED');
    expect(resWrongPwd.body.error.message).toBe('Correo o contraseña incorrectos');

    // 2. Correo inexistente
    const resUnknownEmail = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.0.2.2')
      .send({
        email: 'no.such.user@example.test',
        password: 'AnyPassword!',
      });

    expect(resUnknownEmail.status).toBe(401);
    expect(resUnknownEmail.body.error.code).toBe('UNAUTHORIZED');
    expect(resUnknownEmail.body.error.message).toBe('Correo o contraseña incorrectos');
  }, 30_000);

  it('locks the account after five consecutive failures with 429 ACCOUNT_LOCKED (CA3)', async () => {
    const email = `lockout.${Date.now()}@example.test`;
    await createFixtureUser({ email, password: 'CorrectPassword123!' });

    // Ejecutar 5 intentos fallidos desde IPs distintas para no activar el rate limit por IP
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post('/auth/login')
        .set('x-forwarded-for', `10.0.3.${i}`)
        .send({ email, password: 'BadPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }

    // El 6.º intento debe ser bloqueado con 429 y cabecera Retry-After
    const res6 = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.0.3.6')
      .send({ email, password: 'BadPassword!' });

    expect(res6.status).toBe(429);
    expect(res6.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(res6.headers['retry-after']).toBeDefined();
    expect(Number(res6.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(res6.headers['retry-after'])).toBeLessThanOrEqual(900);
    expect(res6.body.error.retryAfterSeconds).toBeDefined();
  }, 30_000);

  it('does not exceed the attempt limit under concurrent requests', async () => {
    const email = `concurrent.${Date.now()}@example.test`;
    const created = await createFixtureUser({ email, password: 'CorrectPassword123!' });

    // Disparar 6 peticiones en paralelo sobre el mismo correo con contraseñas erróneas desde IPs diferentes
    const requests = Array.from({ length: 6 }, (_, i) =>
      request(app)
        .post('/auth/login')
        .set('x-forwarded-for', `10.0.4.${i + 1}`)
        .send({ email, password: 'WrongPassword!' }),
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);
    expect(statuses).toContain(401);

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(inDb.failedLoginAttempts).toBe(5);
    expect(inDb.lockedUntil).not.toBeNull();
  }, 30_000);

  it('rejects inactive and pending activation users with 403 (CA4)', async () => {
    const inactiveEmail = `inactive.${Date.now()}@example.test`;
    await createFixtureUser({
      email: inactiveEmail,
      password: 'Password123!',
      status: 'INACTIVE',
    });

    const resInactive = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.0.5.1')
      .send({ email: inactiveEmail, password: 'Password123!' });

    expect(resInactive.status).toBe(403);
    expect(resInactive.body.error.code).toBe('ACCOUNT_INACTIVE');

    const pendingEmail = `pending.${Date.now()}@example.test`;
    await createFixtureUser({
      email: pendingEmail,
      password: 'Password123!',
      status: 'PENDING_ACTIVATION',
    });

    const resPending = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.0.5.2')
      .send({ email: pendingEmail, password: 'Password123!' });

    expect(resPending.status).toBe(403);
    expect(resPending.body.error.code).toBe('ACCOUNT_PENDING_ACTIVATION');
  }, 30_000);

  it('audits login success and failure transactions in PostgreSQL append-only audit table', async () => {
    const email = `audit.${Date.now()}@example.test`;
    const user = await createFixtureUser({ email, password: 'SecretPassword123!' });

    // Intento fallido
    await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.0.6.1')
      .send({ email, password: 'WrongPassword!' });

    // Intento exitoso
    await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.0.6.2')
      .send({ email, password: 'SecretPassword123!' });

    const auditRecords = await prisma.auditLog.findMany({
      where: {
        entity: 'User',
        entityId: user.id,
      },
      orderBy: { sequence: 'asc' },
    });

    expect(auditRecords.length).toBeGreaterThanOrEqual(2);
    const actions = auditRecords.map((r) => r.action);
    expect(actions).toContain('LOGIN_FAILURE');
    expect(actions).toContain('LOGIN_SUCCESS');

    // Comprobar que no se registraron secretos
    const allAuditJson = JSON.stringify(auditRecords, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    expect(allAuditJson).not.toContain('SecretPassword123!');
    expect(allAuditJson).not.toContain('WrongPassword!');
  }, 30_000);

  it('returns 400 for an invalid body without logging attempt in audit', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.0.7.1')
      .send({ email: 'not-an-email', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 429 after exceeding the login rate limit for the same IP', async () => {
    const rateLimitIp = '10.0.8.1';

    // Enviar 10 peticiones para agotar el cupo (límite 10 por min)
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/auth/login')
        .set('x-forwarded-for', rateLimitIp)
        .send({ email: 'rate.limit@example.test', password: 'AnyPassword!' });
    }

    // La petición 11 debe ser rechazada con 429 RATE_LIMITED
    const resBlocked = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', rateLimitIp)
      .send({ email: 'rate.limit@example.test', password: 'AnyPassword!' });

    expect(resBlocked.status).toBe(429);
    expect(resBlocked.body.error.code).toBe('RATE_LIMITED');
  }, 30_000);

  it('is public and needs no authorization bearer token', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.0.9.1')
      .send({ email: 'public@example.test', password: 'password' });

    // No debe devolver 401 por falta de token JWT (solo por credenciales si no existe)
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Correo o contraseña incorrectos');
  });
});
