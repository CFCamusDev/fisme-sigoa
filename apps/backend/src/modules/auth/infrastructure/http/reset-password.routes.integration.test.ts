import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { RandomActivationTokenGenerator } from '../security/random-activation-token-generator.js';
import { Argon2PasswordHasher } from '../security/argon2-password-hasher.js';

describe('POST /auth/reset-password Integration (PostgreSQL real, Argon2 real, Supertest, CA1, CA2, CA3, RF-005, RS-002, RS-020, RNF-007, RNF-008)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const tokenGenerator = new RandomActivationTokenGenerator();
  const passwordHasher = new Argon2PasswordHasher();

  function setupTestApp(options?: { rateLimitMax?: number }) {
    const env = createTestEnv({
      AUTH_MAX_FAILED_ATTEMPTS: 5,
      AUTH_LOCKOUT_MINUTES: 15,
      RATE_LIMIT_PUBLIC_MAX: options?.rateLimitMax ?? 100,
      TRUST_PROXY: 1,
      APP_PUBLIC_URL: 'https://sigoa.untrm.edu.pe',
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

    return { app, env, uow, auditServices };
  }

  async function createUser(overrides: {
    email: string;
    names?: string;
    firstSurname?: string;
    secondSurname?: string | null;
    dni?: string | null;
    status: 'ACTIVE' | 'PENDING_ACTIVATION' | 'INACTIVE';
    rawPassword?: string;
  }) {
    const passwordHash = overrides.rawPassword
      ? await passwordHasher.hash(overrides.rawPassword)
      : '$argon2id$v=19$m=65536,t=3,p=4$realPasswordHash123';

    return prisma.user.create({
      data: {
        email: overrides.email,
        names: overrides.names ?? 'Carlos',
        firstSurname: overrides.firstSurname ?? 'Mendoza',
        secondSurname: overrides.secondSurname ?? null,
        dni:
          overrides.dni !== undefined
            ? overrides.dni
            : String(Math.floor(10000000 + Math.random() * 89999999)),
        status: overrides.status,
        passwordHash,
      },
    });
  }

  async function createPasswordResetTokenRecord(overrides: {
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
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 2 * 3600 * 1000),
        usedAt: overrides.usedAt ?? null,
        revokedAt: overrides.revokedAt ?? null,
      },
    });
  }

  function generateRawToken(): string {
    return tokenGenerator.generate(new Date()).token;
  }

  async function createActiveSession(userId: string) {
    const rawRefreshToken = generateRawToken();
    const tokenHash = tokenGenerator.hash(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    const session = await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        createdByIp: '190.237.10.1',
      },
    });

    return { session, rawRefreshToken };
  }

  it('resets password with a valid link, updates hash in DB, marks token used, revokes sessions and writes audit (CA1, RS-015, RS-020)', async () => {
    const { app } = setupTestApp();
    const email = `reset.success.${Date.now()}@untrm.edu.pe`;
    const initialPassword = 'InitialValidPass123!';
    const user = await createUser({ email, status: 'ACTIVE', rawPassword: initialPassword });

    // Crear dos sesiones activas
    await createActiveSession(user.id);
    await createActiveSession(user.id);

    const rawToken = generateRawToken();
    await createPasswordResetTokenRecord({ userId: user.id, rawToken });

    const newPassword = 'NewStrongPassword2026*';
    const clientIp = '190.237.10.25';

    const res = await request(app)
      .post('/auth/reset-password')
      .set('x-forwarded-for', clientIp)
      .send({
        token: rawToken,
        password: newPassword,
      });

    // 1. Verificación HTTP
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.pragma).toBe('no-cache');
    expect(res.body).toEqual({ status: 'PASSWORD_RESET' });

    // 2. Verificación en PostgreSQL: usuario actualizado
    const inDbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(inDbUser.passwordHash).not.toBeNull();
    const isNewPasswordValid = await passwordHasher.verify(newPassword, inDbUser.passwordHash!);
    expect(isNewPasswordValid).toBe(true);

    // 3. Verificación en PostgreSQL: token marcado como consumido
    const inDbToken = await prisma.activationToken.findUniqueOrThrow({
      where: { tokenHash: tokenGenerator.hash(rawToken) },
    });
    expect(inDbToken.usedAt).not.toBeNull();
    expect(inDbToken.revokedAt).toBeNull();

    // 4. Verificación en PostgreSQL: todas las sesiones activas revocadas
    const userSessions = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(userSessions).toHaveLength(2);
    for (const session of userSessions) {
      expect(session.revokedAt).not.toBeNull();
    }

    // 5. Verificación de Auditoría
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity: { in: ['User', 'ActivationToken'] },
        entityId: { in: [user.id, inDbToken.id] },
      },
      orderBy: { sequence: 'asc' },
    });
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    const auditJson = JSON.stringify(auditLogs, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
    expect(auditJson).toContain(clientIp);
    expect(auditJson).not.toContain(rawToken);
    expect(auditJson).not.toContain(tokenGenerator.hash(rawToken));
    expect(auditJson).not.toContain(newPassword);
    expect(auditJson).not.toContain(initialPassword);
  }, 30000);

  it('allows login with the new password and rejects the old password (CA2)', async () => {
    const { app } = setupTestApp();
    const email = `reset.login.${Date.now()}@untrm.edu.pe`;
    const oldPassword = 'OldValidPassword123!';
    const user = await createUser({ email, status: 'ACTIVE', rawPassword: oldPassword });

    const rawToken = generateRawToken();
    await createPasswordResetTokenRecord({ userId: user.id, rawToken });

    const newPassword = 'NewBrandNewPassword2026!';

    // Restablecer contraseña
    const resetRes = await request(app)
      .post('/auth/reset-password')
      .send({ token: rawToken, password: newPassword });
    expect(resetRes.status).toBe(200);

    // Intento 1: Iniciar sesión con contraseña anterior -> rechazado 401
    const oldLoginRes = await request(app)
      .post('/auth/login')
      .send({ email, password: oldPassword });
    expect(oldLoginRes.status).toBe(401);
    expect(oldLoginRes.body.error.code).toBe('UNAUTHORIZED');

    // Intento 2: Iniciar sesión con nueva contraseña -> exitoso 200
    const newLoginRes = await request(app)
      .post('/auth/login')
      .send({ email, password: newPassword });
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.accessToken).toBeDefined();
    expect(newLoginRes.body.user.email).toBe(email);
  }, 30000);

  it('answers 400 INVALID_PASSWORD_RESET_TOKEN for used, expired, revoked, unknown tokens, or tokens belonging to inactive/pending users (CA3)', async () => {
    const { app } = setupTestApp();
    const newPassword = 'AnyStrongPassword123!';

    // Caso 1: Token desconocido / inexistente
    const unknownToken = generateRawToken();
    const resUnknown = await request(app)
      .post('/auth/reset-password')
      .send({ token: unknownToken, password: newPassword });
    expect(resUnknown.status).toBe(400);
    expect(resUnknown.body.error.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
    expect(resUnknown.body.error.message).toBe('El enlace no es válido o venció.');

    // Caso 2: Token ya utilizado (usedAt no nulo)
    const user1 = await createUser({
      email: `used.${Date.now()}@untrm.edu.pe`,
      status: 'ACTIVE',
    });
    const usedToken = generateRawToken();
    await createPasswordResetTokenRecord({
      userId: user1.id,
      rawToken: usedToken,
      usedAt: new Date(Date.now() - 60000),
    });
    const resUsed = await request(app)
      .post('/auth/reset-password')
      .send({ token: usedToken, password: newPassword });
    expect(resUsed.status).toBe(400);
    expect(resUsed.body.error.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
    expect(resUsed.body.error.message).toBe('El enlace no es válido o venció.');

    // Caso 3: Token expirado
    const user2 = await createUser({
      email: `expired.${Date.now()}@untrm.edu.pe`,
      status: 'ACTIVE',
    });
    const expiredToken = generateRawToken();
    await createPasswordResetTokenRecord({
      userId: user2.id,
      rawToken: expiredToken,
      expiresAt: new Date(Date.now() - 3600000),
    });
    const resExpired = await request(app)
      .post('/auth/reset-password')
      .send({ token: expiredToken, password: newPassword });
    expect(resExpired.status).toBe(400);
    expect(resExpired.body.error.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
    expect(resExpired.body.error.message).toBe('El enlace no es válido o venció.');

    // Caso 4: Token revocado
    const user3 = await createUser({
      email: `revoked.${Date.now()}@untrm.edu.pe`,
      status: 'ACTIVE',
    });
    const revokedToken = generateRawToken();
    await createPasswordResetTokenRecord({
      userId: user3.id,
      rawToken: revokedToken,
      revokedAt: new Date(Date.now() - 60000),
    });
    const resRevoked = await request(app)
      .post('/auth/reset-password')
      .send({ token: revokedToken, password: newPassword });
    expect(resRevoked.status).toBe(400);
    expect(resRevoked.body.error.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
    expect(resRevoked.body.error.message).toBe('El enlace no es válido o venció.');

    // Caso 5: Usuario INACTIVE
    const userInactive = await createUser({
      email: `inactive.${Date.now()}@untrm.edu.pe`,
      status: 'INACTIVE',
    });
    const inactiveToken = generateRawToken();
    await createPasswordResetTokenRecord({
      userId: userInactive.id,
      rawToken: inactiveToken,
    });
    const resInactive = await request(app)
      .post('/auth/reset-password')
      .send({ token: inactiveToken, password: newPassword });
    expect(resInactive.status).toBe(400);
    expect(resInactive.body.error.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
    expect(resInactive.body.error.message).toBe('El enlace no es válido o venció.');

    // Caso 6: Usuario PENDING_ACTIVATION
    const userPending = await createUser({
      email: `pending.${Date.now()}@untrm.edu.pe`,
      status: 'PENDING_ACTIVATION',
    });
    const pendingToken = generateRawToken();
    await createPasswordResetTokenRecord({
      userId: userPending.id,
      rawToken: pendingToken,
    });
    const resPending = await request(app)
      .post('/auth/reset-password')
      .send({ token: pendingToken, password: newPassword });
    expect(resPending.status).toBe(400);
    expect(resPending.body.error.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
    expect(resPending.body.error.message).toBe('El enlace no es válido o venció.');
  }, 30000);

  it('answers 400 VALIDATION_ERROR with policy details for a weak password', async () => {
    const { app } = setupTestApp();
    const rawToken = generateRawToken();

    const response = await request(app).post('/auth/reset-password').send({
      token: rawToken,
      password: 'weak',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toBeDefined();
    expect(response.body.error.details.length).toBeGreaterThan(0);
    expect(response.body.error.details[0].path).toBe('body.password');
  });

  it('answers 429 RATE_LIMITED after exceeding the public rate limit', async () => {
    const { app } = setupTestApp({ rateLimitMax: 3 });
    const ip = '198.51.100.99';

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/auth/reset-password')
        .set('x-forwarded-for', ip)
        .send({ token: '', password: 'any' });
      // Código 400 por validación, pero consume rate limit
      expect(res.status).toBe(400);
    }

    const blockedRes = await request(app)
      .post('/auth/reset-password')
      .set('x-forwarded-for', ip)
      .send({ token: '', password: 'any' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe('RATE_LIMITED');
  });

  it('handles concurrency: exactly 1 of N concurrent requests succeeds and others receive 400 INVALID_PASSWORD_RESET_TOKEN', async () => {
    const { app } = setupTestApp({ rateLimitMax: 100 });
    const email = `concurrent.reset.${Date.now()}@untrm.edu.pe`;
    const user = await createUser({
      email,
      status: 'ACTIVE',
      rawPassword: 'OldConcurrentPassword123!',
    });

    const rawToken = generateRawToken();
    await createPasswordResetTokenRecord({ userId: user.id, rawToken });

    const attemptsCount = 5;
    const requests = Array.from({ length: attemptsCount }, (_, i) =>
      request(app)
        .post('/auth/reset-password')
        .set('x-forwarded-for', `192.168.10.${10 + i}`)
        .send({
          token: rawToken,
          password: `UniquePasswordForAttempt${i + 1}*!`,
        }),
    );

    const responses = await Promise.all(requests);

    const successes = responses.filter((r) => r.status === 200);
    const conflicts = responses.filter(
      (r) => r.status === 400 && r.body?.error?.code === 'INVALID_PASSWORD_RESET_TOKEN',
    );

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(attemptsCount - 1);

    // En PostgreSQL el token debe figurar como consumido
    const inDbToken = await prisma.activationToken.findUniqueOrThrow({
      where: { tokenHash: tokenGenerator.hash(rawToken) },
    });
    expect(inDbToken.usedAt).not.toBeNull();
  }, 40000);
});
