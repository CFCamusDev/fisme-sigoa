import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { RandomActivationTokenGenerator } from '../security/random-activation-token-generator.js';

describe('POST /auth/activate Integration (PostgreSQL real, Argon2 real, Supertest, CA1, CA2, CA3, RF-004, RS-002, RS-020, RNF-007)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const tokenGenerator = new RandomActivationTokenGenerator();

  const env = createTestEnv({
    AUTH_MAX_FAILED_ATTEMPTS: 5,
    AUTH_LOCKOUT_MINUTES: 15,
    RATE_LIMIT_PUBLIC_MAX: 100,
    TRUST_PROXY: 1,
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

  async function createPendingUser(overrides: {
    email: string;
    dni?: string | null;
    secondSurname?: string | null;
    status?: 'PENDING_ACTIVATION' | 'ACTIVE' | 'INACTIVE';
  }) {
    return prisma.user.create({
      data: {
        email: overrides.email,
        names: 'Pending',
        firstSurname: 'Tester',
        secondSurname: overrides.secondSurname !== undefined ? overrides.secondSurname : 'Nullable',
        dni:
          overrides.dni !== undefined
            ? overrides.dni
            : String(Math.floor(10000000 + Math.random() * 89999999)),
        status: overrides.status ?? 'PENDING_ACTIVATION',
        passwordHash: null,
      },
    });
  }

  async function createActivationTokenRecord(overrides: {
    userId: string;
    rawToken: string;
    expiresAt?: Date;
    usedAt?: Date | null;
    revokedAt?: Date | null;
  }) {
    const tokenHash = tokenGenerator.hash(overrides.rawToken);
    return prisma.activationToken.create({
      data: {
        userId: overrides.userId,
        tokenHash,
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 48 * 3600 * 1000),
        usedAt: overrides.usedAt ?? null,
        revokedAt: overrides.revokedAt ?? null,
      },
    });
  }

  it('activates an account with a valid link and lets the user sign in with the new password (CA1, RS-015, RS-020)', async () => {
    const email = `activate.success.${Date.now()}@untrm.edu.pe`;
    const user = await createPendingUser({ email });
    const rawToken = `token-success-${Date.now()}-abc`;
    await createActivationTokenRecord({ userId: user.id, rawToken });

    const newPassword = 'MyStrongPassword2026*';

    const res = await request(app).post('/auth/activate').set('x-forwarded-for', '10.20.1.1').send({
      token: rawToken,
      password: newPassword,
    });

    // 1. Verificación HTTP y cabeceras
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.pragma).toBe('no-cache');
    expect(res.body).toEqual({ status: 'ACTIVE' });

    // 2. Verificación en PostgreSQL
    const inDbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(inDbUser.status).toBe('ACTIVE');
    expect(inDbUser.passwordHash).not.toBeNull();
    expect(inDbUser.passwordHash).not.toBe(newPassword);

    const tokenHash = tokenGenerator.hash(rawToken);
    const inDbToken = await prisma.activationToken.findUniqueOrThrow({ where: { tokenHash } });
    expect(inDbToken.usedAt).not.toBeNull();

    // 3. Inicio de sesión inmediato con la nueva contraseña
    const loginRes = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', '10.20.1.2')
      .send({
        email,
        password: newPassword,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.user.id).toBe(user.id);
    expect(loginRes.body.user.email).toBe(email);
    expect(loginRes.headers['set-cookie']).toBeDefined();

    // 4. Verificación de auditoría append-only en la misma transacción
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity: { in: ['User', 'ActivationToken'] },
        entityId: { in: [user.id, inDbToken.id] },
      },
      orderBy: { sequence: 'asc' },
    });

    expect(auditLogs.length).toBeGreaterThanOrEqual(2);
    const auditJson = JSON.stringify(auditLogs, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
    expect(auditJson).not.toContain(rawToken);
    expect(auditJson).not.toContain(newPassword);
    expect(auditJson).not.toContain(inDbUser.passwordHash!);
  }, 30_000);

  it('activates a user without dni and without second surname (datos incompletos pero válidos, AGENTS §9)', async () => {
    const email = `activate.incomplete.${Date.now()}@untrm.edu.pe`;
    const user = await createPendingUser({
      email,
      dni: null,
      secondSurname: null,
    });
    const rawToken = `token-incomplete-${Date.now()}-xyz`;
    await createActivationTokenRecord({ userId: user.id, rawToken });

    const res = await request(app).post('/auth/activate').set('x-forwarded-for', '10.20.2.1').send({
      token: rawToken,
      password: 'ValidPassword2026*',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ACTIVE' });

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(inDb.status).toBe('ACTIVE');
    expect(inDb.dni).toBeNull();
    expect(inDb.secondSurname).toBeNull();
  }, 30_000);

  it('returns the same 400 INVALID_ACTIVATION_TOKEN for an unknown, used, expired, revoked token and a non-pending user (CA2, RS-007)', async () => {
    const password = 'StrongPassword123*';

    // A. Token desconocido
    const resUnknown = await request(app)
      .post('/auth/activate')
      .set('x-forwarded-for', '10.20.3.1')
      .send({ token: 'unknown-activation-token-999', password });

    expect(resUnknown.status).toBe(400);
    expect(resUnknown.body.error.code).toBe('INVALID_ACTIVATION_TOKEN');
    expect(resUnknown.body.error.message).toBe('El enlace no es válido o venció.');

    // B. Token ya usado
    const userUsed = await createPendingUser({ email: `used.${Date.now()}@untrm.edu.pe` });
    const tokenUsed = `used-token-${Date.now()}`;
    await createActivationTokenRecord({
      userId: userUsed.id,
      rawToken: tokenUsed,
      usedAt: new Date(),
    });

    const resUsed = await request(app)
      .post('/auth/activate')
      .set('x-forwarded-for', '10.20.3.2')
      .send({ token: tokenUsed, password });

    expect(resUsed.status).toBe(400);
    expect(resUsed.body.error.code).toBe('INVALID_ACTIVATION_TOKEN');
    expect(resUsed.body.error.message).toBe('El enlace no es válido o venció.');

    // C. Token expirado (> 48h)
    const userExpired = await createPendingUser({ email: `expired.${Date.now()}@untrm.edu.pe` });
    const tokenExpired = `expired-token-${Date.now()}`;
    await createActivationTokenRecord({
      userId: userExpired.id,
      rawToken: tokenExpired,
      expiresAt: new Date(Date.now() - 3600_000),
    });

    const resExpired = await request(app)
      .post('/auth/activate')
      .set('x-forwarded-for', '10.20.3.3')
      .send({ token: tokenExpired, password });

    expect(resExpired.status).toBe(400);
    expect(resExpired.body.error.code).toBe('INVALID_ACTIVATION_TOKEN');
    expect(resExpired.body.error.message).toBe('El enlace no es válido o venció.');

    // D. Token revocado
    const userRevoked = await createPendingUser({ email: `revoked.${Date.now()}@untrm.edu.pe` });
    const tokenRevoked = `revoked-token-${Date.now()}`;
    await createActivationTokenRecord({
      userId: userRevoked.id,
      rawToken: tokenRevoked,
      revokedAt: new Date(),
    });

    const resRevoked = await request(app)
      .post('/auth/activate')
      .set('x-forwarded-for', '10.20.3.4')
      .send({ token: tokenRevoked, password });

    expect(resRevoked.status).toBe(400);
    expect(resRevoked.body.error.code).toBe('INVALID_ACTIVATION_TOKEN');
    expect(resRevoked.body.error.message).toBe('El enlace no es válido o venció.');

    // E. Usuario ya activo
    const userActive = await createPendingUser({
      email: `already-active.${Date.now()}@untrm.edu.pe`,
      status: 'ACTIVE',
    });
    const tokenActive = `active-user-token-${Date.now()}`;
    await createActivationTokenRecord({
      userId: userActive.id,
      rawToken: tokenActive,
    });

    const resActive = await request(app)
      .post('/auth/activate')
      .set('x-forwarded-for', '10.20.3.5')
      .send({ token: tokenActive, password });

    expect(resActive.status).toBe(400);
    expect(resActive.body.error.code).toBe('INVALID_ACTIVATION_TOKEN');
    expect(resActive.body.error.message).toBe('El enlace no es válido o venció.');
  }, 30_000);

  it('returns 400 with details for a weak password and keeps the token usable (CA3)', async () => {
    const email = `weak-pwd.${Date.now()}@untrm.edu.pe`;
    const user = await createPendingUser({ email });
    const rawToken = `token-weak-${Date.now()}`;
    await createActivationTokenRecord({ userId: user.id, rawToken });

    // Intento con contraseña débil
    const res = await request(app).post('/auth/activate').set('x-forwarded-for', '10.20.4.1').send({
      token: rawToken,
      password: 'weak',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
    expect(res.body.error.details.length).toBeGreaterThan(0);
    expect(res.body.error.details[0].path).toBe('body.password');

    // El token sigue estando intacto y usable
    const tokenHash = tokenGenerator.hash(rawToken);
    const inDbToken = await prisma.activationToken.findUniqueOrThrow({ where: { tokenHash } });
    expect(inDbToken.usedAt).toBeNull();
    expect(inDbToken.revokedAt).toBeNull();

    // El usuario puede activarse luego con una contraseña válida
    const resRetry = await request(app)
      .post('/auth/activate')
      .set('x-forwarded-for', '10.20.4.2')
      .send({
        token: rawToken,
        password: 'ValidPassword123*',
      });

    expect(resRetry.status).toBe(200);
    expect(resRetry.body).toEqual({ status: 'ACTIVE' });
  }, 30_000);

  it('rejects an empty body, an unknown field, a missing token and oversized inputs (entradas hostiles)', async () => {
    // 1. Cuerpo vacío
    const resEmpty = await request(app)
      .post('/auth/activate')
      .set('x-forwarded-for', '10.20.5.1')
      .send({});
    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.error.code).toBe('VALIDATION_ERROR');

    // 2. Campo desconocido (strict)
    const resExtra = await request(app)
      .post('/auth/activate')
      .set('x-forwarded-for', '10.20.5.2')
      .send({
        token: 'valid-token-example',
        password: 'ValidPassword123*',
        extraForbiddenField: 'exploit',
      });
    expect(resExtra.status).toBe(400);
    expect(resExtra.body.error.code).toBe('VALIDATION_ERROR');

    // 3. Token con longitud excesiva (> 128)
    const resLongToken = await request(app)
      .post('/auth/activate')
      .set('x-forwarded-for', '10.20.5.3')
      .send({
        token: 'a'.repeat(129),
        password: 'ValidPassword123*',
      });
    expect(resLongToken.status).toBe(400);
    expect(resLongToken.body.error.code).toBe('VALIDATION_ERROR');

    // 4. Contraseña con longitud excesiva (> 128)
    const resLongPassword = await request(app)
      .post('/auth/activate')
      .set('x-forwarded-for', '10.20.5.4')
      .send({
        token: 'valid-token-example',
        password: 'A1*' + 'a'.repeat(126),
      });
    expect(resLongPassword.status).toBe(400);
    expect(resLongPassword.body.error.code).toBe('VALIDATION_ERROR');
  }, 30_000);

  it('returns 429 when the public rate limit is exceeded', async () => {
    const limitedEnv = createTestEnv({
      AUTH_MAX_FAILED_ATTEMPTS: 5,
      AUTH_LOCKOUT_MINUTES: 15,
      RATE_LIMIT_PUBLIC_MAX: 3,
      TRUST_PROXY: 1,
    });

    const limitedApp = createApp({
      env: limitedEnv,
      setupRoutes: (instance) => {
        setupAppRoutes(instance, {
          unitOfWork: uow,
          auditLogger: auditServices.auditLogger,
          dbProvider: uow,
          env: limitedEnv,
        });
      },
    });

    const rateLimitIp = '10.20.6.99';

    // Agotar las 3 peticiones permitidas
    for (let i = 0; i < 3; i++) {
      await request(limitedApp)
        .post('/auth/activate')
        .set('x-forwarded-for', rateLimitIp)
        .send({ token: 'dummy-token', password: 'ValidPassword123*' });
    }

    // La 4ta petición es bloqueada con 429 RATE_LIMITED
    const resBlocked = await request(limitedApp)
      .post('/auth/activate')
      .set('x-forwarded-for', rateLimitIp)
      .send({ token: 'dummy-token', password: 'ValidPassword123*' });

    expect(resBlocked.status).toBe(429);
    expect(resBlocked.body.error.code).toBe('RATE_LIMITED');
  }, 30_000);

  it('serializes concurrent activations and exactly one of N concurrent requests activates the account (D7, AGENTS §9)', async () => {
    const email = `concurrent.http.${Date.now()}@untrm.edu.pe`;
    const user = await createPendingUser({ email });
    const rawToken = `token-concurrent-${Date.now()}-race`;
    await createActivationTokenRecord({ userId: user.id, rawToken });

    const N = 5;
    const strongPassword = 'RacePassword2026*';

    // Lanzar N peticiones en paralelo compitiendo por el mismo token por HTTP
    const results = await Promise.allSettled(
      Array.from({ length: N }).map(async (_, idx) => {
        return request(app)
          .post('/auth/activate')
          .set('x-forwarded-for', `10.20.7.${idx + 1}`)
          .send({
            token: rawToken,
            password: strongPassword,
          });
      }),
    );

    const responses = results
      .filter((r): r is PromiseFulfilledResult<request.Response> => r.status === 'fulfilled')
      .map((r) => r.value);

    const okResponses = responses.filter((r) => r.status === 200);
    const conflictResponses = responses.filter((r) => r.status === 400);

    expect(okResponses).toHaveLength(1);
    expect(okResponses[0]!.body).toEqual({ status: 'ACTIVE' });

    expect(conflictResponses).toHaveLength(N - 1);
    for (const res of conflictResponses) {
      expect(res.body.error.code).toBe('INVALID_ACTIVATION_TOKEN');
    }

    const inDbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(inDbUser.status).toBe('ACTIVE');

    const inDbToken = await prisma.activationToken.findUniqueOrThrow({
      where: { tokenHash: tokenGenerator.hash(rawToken) },
    });
    expect(inDbToken.usedAt).not.toBeNull();
  }, 30_000);

  it('does not expose the token, the password or the hash in the response (RS-002, RNF-005)', async () => {
    const email = `no-leak.${Date.now()}@untrm.edu.pe`;
    const user = await createPendingUser({ email });
    const rawToken = `token-noleak-${Date.now()}`;
    await createActivationTokenRecord({ userId: user.id, rawToken });

    const password = 'NoLeakPassword2026*';

    const res = await request(app)
      .post('/auth/activate')
      .set('x-forwarded-for', '10.20.8.1')
      .send({ token: rawToken, password });

    expect(res.status).toBe(200);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain(rawToken);
    expect(bodyStr).not.toContain(password);
    expect(bodyStr).not.toContain('argon2');
    expect(res.body).toEqual({ status: 'ACTIVE' });
  }, 30_000);

  it('is a public endpoint and does not require bearer authentication (RS-002; sin 403)', async () => {
    const res = await request(app)
      .post('/auth/activate')
      .set('x-forwarded-for', '10.20.9.1')
      .send({ token: 'unknown', password: 'ValidPassword123*' });

    // No debe responder 401 Unauthorized ni 403 Forbidden por autenticación/permisos
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(400);
  });
});
