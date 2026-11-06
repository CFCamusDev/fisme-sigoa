import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { RandomActivationTokenGenerator } from '../security/random-activation-token-generator.js';
import type { EmailMessage, EmailSender } from '../../../../shared/email/email-sender.js';
import type { DetachedTask, DetachedTaskRunner } from '../../application/detached-task-runner.js';

describe('POST /auth/forgot-password Integration (PostgreSQL real, Supertest, CA1, RF-005, RS-002, RS-020, RNF-007, RNF-008)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const tokenGenerator = new RandomActivationTokenGenerator();

  class TestDetachedTaskRunner implements DetachedTaskRunner {
    private readonly tasks: Promise<void>[] = [];

    run(task: DetachedTask): void {
      const p = Promise.resolve().then(task);
      this.tasks.push(p);
    }

    async waitForAll(): Promise<void> {
      await Promise.all(this.tasks);
    }
  }

  function setupTestApp(options?: {
    rateLimitMax?: number;
    emailSender?: EmailSender;
    detachedRunner?: DetachedTaskRunner;
  }) {
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
          emailSender: options?.emailSender,
          detachedTaskRunner: options?.detachedRunner,
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
  }) {
    return prisma.user.create({
      data: {
        email: overrides.email,
        names: overrides.names ?? 'Carlos',
        firstSurname: overrides.firstSurname ?? 'Mendoza',
        secondSurname: overrides.secondSurname ?? null,
        dni: overrides.dni ?? null,
        status: overrides.status,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$realPasswordHash123',
      },
    });
  }

  it('answers 202 with the same status, body and cache headers for known, unknown, inactive and pending emails (CA1)', async () => {
    const activeEmail = `known.active.${Date.now()}@untrm.edu.pe`;
    const pendingEmail = `known.pending.${Date.now()}@untrm.edu.pe`;
    const inactiveEmail = `known.inactive.${Date.now()}@untrm.edu.pe`;
    const unknownEmail = `unknown.user.${Date.now()}@untrm.edu.pe`;

    await createUser({ email: activeEmail, status: 'ACTIVE' });
    await createUser({ email: pendingEmail, status: 'PENDING_ACTIVATION' });
    await createUser({ email: inactiveEmail, status: 'INACTIVE' });

    const sentEmails: EmailMessage[] = [];
    const mockEmailSender: EmailSender = {
      send: async (msg: EmailMessage) => {
        sentEmails.push(msg);
        return { messageId: 'msg-id-123' };
      },
    };

    const detachedRunner = new TestDetachedTaskRunner();
    const { app } = setupTestApp({ emailSender: mockEmailSender, detachedRunner });

    const emailsToTest = [activeEmail, unknownEmail, pendingEmail, inactiveEmail];

    for (const email of emailsToTest) {
      const res = await request(app).post('/auth/forgot-password').send({ email });

      expect(res.status).toBe(202);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers.pragma).toBe('no-cache');
      expect(res.body).toEqual({ status: 'RECEIVED' });
    }

    await detachedRunner.waitForAll();

    // Solo el usuario activo debe haber recibido un correo
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]!.to).toBe(activeEmail);
  }, 30_000);

  it('sends one reset email with a link that has the token and stores only its hash in PostgreSQL', async () => {
    const email = `active.send.${Date.now()}@untrm.edu.pe`;
    const user = await createUser({ email, status: 'ACTIVE' });

    const sentEmails: EmailMessage[] = [];
    const mockEmailSender: EmailSender = {
      send: async (msg: EmailMessage) => {
        sentEmails.push(msg);
        return { messageId: 'msg-rec-1' };
      },
    };

    const detachedRunner = new TestDetachedTaskRunner();
    const { app } = setupTestApp({ emailSender: mockEmailSender, detachedRunner });

    const res = await request(app).post('/auth/forgot-password').send({ email });

    expect(res.status).toBe(202);

    await detachedRunner.waitForAll();

    expect(sentEmails).toHaveLength(1);
    const sent = sentEmails[0]!;
    expect(sent.to).toBe(email);
    expect(sent.template).toBe('password-reset');

    const resetUrl = sent.variables['resetUrl'] as string;
    expect(resetUrl).toContain('https://sigoa.untrm.edu.pe/restablecer/');
    const rawToken = decodeURIComponent(resetUrl.split('/restablecer/')[1]!);

    // Verificar en PostgreSQL que se guardó solo el hash
    const expectedHash = tokenGenerator.hash(rawToken);
    const inDbToken = await prisma.activationToken.findUniqueOrThrow({
      where: { tokenHash: expectedHash },
    });
    expect(inDbToken.userId).toBe(user.id);
    expect(inDbToken.usedAt).toBeNull();
    expect(inDbToken.revokedAt).toBeNull();
    expect((inDbToken as unknown as { token?: string }).token).toBeUndefined();
  }, 30_000);

  it('audits the request without the token, the hash or the email', async () => {
    const email = `audit.test.${Date.now()}@untrm.edu.pe`;
    const user = await createUser({ email, status: 'ACTIVE' });

    const detachedRunner = new TestDetachedTaskRunner();
    const { app } = setupTestApp({ detachedRunner });

    const res = await request(app)
      .post('/auth/forgot-password')
      .set('x-forwarded-for', '190.237.10.88')
      .send({ email });

    expect(res.status).toBe(202);
    await detachedRunner.waitForAll();

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entity: 'User',
        entityId: user.id,
        action: 'UPDATE',
      },
      orderBy: { occurredAt: 'desc' },
    });

    expect(auditLog).not.toBeNull();
    expect(auditLog?.actor).toBe(user.id);
    expect(auditLog?.ip).toBe('190.237.10.88');

    const afterJson = JSON.stringify(auditLog?.after).toLowerCase();
    expect(afterJson).toContain('passwordrecoveryrequested');
    expect(afterJson).not.toContain(email.toLowerCase());
    expect(afterJson).not.toContain('token');
    expect(afterJson).not.toContain('hash');
  }, 30_000);

  it('normalizes a padded and uppercase email with missing optional fields', async () => {
    const email = `normalized.user.${Date.now()}@untrm.edu.pe`;
    const user = await createUser({
      email,
      status: 'ACTIVE',
      dni: null,
      secondSurname: null,
    });

    const sentEmails: EmailMessage[] = [];
    const mockEmailSender: EmailSender = {
      send: async (msg: EmailMessage) => {
        sentEmails.push(msg);
        return { messageId: 'msg-norm-1' };
      },
    };

    const detachedRunner = new TestDetachedTaskRunner();
    const { app } = setupTestApp({ emailSender: mockEmailSender, detachedRunner });

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: `   ${email.toUpperCase()}   ` });

    expect(res.status).toBe(202);
    await detachedRunner.waitForAll();

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]!.to).toBe(email);

    const tokens = await prisma.activationToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(1);
  }, 30_000);

  it('does not send a second email inside the cooldown (60s)', async () => {
    const email = `cooldown.test.${Date.now()}@untrm.edu.pe`;
    await createUser({ email, status: 'ACTIVE' });

    const sentEmails: EmailMessage[] = [];
    const mockEmailSender: EmailSender = {
      send: async (msg: EmailMessage) => {
        sentEmails.push(msg);
        return { messageId: 'msg-cd-1' };
      },
    };

    const detachedRunner = new TestDetachedTaskRunner();
    const { app } = setupTestApp({ emailSender: mockEmailSender, detachedRunner });

    // Primera solicitud: debe emitir y enviar
    const res1 = await request(app).post('/auth/forgot-password').send({ email });
    expect(res1.status).toBe(202);
    await detachedRunner.waitForAll();
    expect(sentEmails).toHaveLength(1);

    // Segunda solicitud inmediata (< 60s): respuesta idéntica pero sin segundo correo
    const res2 = await request(app).post('/auth/forgot-password').send({ email });
    expect(res2.status).toBe(202);
    expect(res2.body).toEqual({ status: 'RECEIVED' });
    await detachedRunner.waitForAll();

    expect(sentEmails).toHaveLength(1);
  }, 30_000);

  it('returns 400 for invalid body: missing body, non-string email, invalid email, email > 254 chars, unknown fields', async () => {
    const { app } = setupTestApp();

    // 1. Cuerpo ausente
    const res1 = await request(app).post('/auth/forgot-password').send();
    expect(res1.status).toBe(400);
    expect(res1.body.error.code).toBe('VALIDATION_ERROR');

    // 2. Email no string
    const res2 = await request(app).post('/auth/forgot-password').send({ email: 12345 });
    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe('VALIDATION_ERROR');

    // 3. Formato inválido
    const res3 = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'bad-email-format' });
    expect(res3.status).toBe(400);
    expect(res3.body.error.code).toBe('VALIDATION_ERROR');

    // 4. Email más largo de 254 caracteres
    const longLocal = 'a'.repeat(250);
    const res4 = await request(app)
      .post('/auth/forgot-password')
      .send({ email: `${longLocal}@untrm.edu.pe` });
    expect(res4.status).toBe(400);
    expect(res4.body.error.code).toBe('VALIDATION_ERROR');

    // 5. Campos desconocidos (.strict())
    const res5 = await request(app).post('/auth/forgot-password').send({
      email: 'valid@untrm.edu.pe',
      extraPayload: true,
    });
    expect(res5.status).toBe(400);
    expect(res5.body.error.code).toBe('VALIDATION_ERROR');
  }, 30_000);

  it('returns 429 after public rate limit is exceeded', async () => {
    const { app } = setupTestApp({ rateLimitMax: 3 });

    const ip = '198.51.100.42';
    const email = `ratelimit.${Date.now()}@untrm.edu.pe`;

    // 3 peticiones permitidas
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/auth/forgot-password')
        .set('x-forwarded-for', ip)
        .send({ email });
      expect(res.status).toBe(202);
    }

    // Cuarta petición: bloqueada por rate limit
    const resBlocked = await request(app)
      .post('/auth/forgot-password')
      .set('x-forwarded-for', ip)
      .send({ email });

    expect(resBlocked.status).toBe(429);
    expect(resBlocked.body.error.code).toBe('RATE_LIMITED');
  }, 30_000);

  it('N concurrent POST /auth/forgot-password for the same email create one token and send one email', async () => {
    const email = `concurrent.http.${Date.now()}@untrm.edu.pe`;
    const user = await createUser({ email, status: 'ACTIVE' });

    const sentEmails: EmailMessage[] = [];
    const mockEmailSender: EmailSender = {
      send: async (msg: EmailMessage) => {
        sentEmails.push(msg);
        return { messageId: 'msg-conc-1' };
      },
    };

    const detachedRunner = new TestDetachedTaskRunner();
    const { app } = setupTestApp({ emailSender: mockEmailSender, detachedRunner });

    // 5 peticiones concurrentes por HTTP
    const responses = await Promise.all([
      request(app).post('/auth/forgot-password').send({ email }),
      request(app).post('/auth/forgot-password').send({ email }),
      request(app).post('/auth/forgot-password').send({ email }),
      request(app).post('/auth/forgot-password').send({ email }),
      request(app).post('/auth/forgot-password').send({ email }),
    ]);

    await detachedRunner.waitForAll();

    // Todas devuelven 202
    for (const res of responses) {
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ status: 'RECEIVED' });
    }

    // Exactamente 1 correo despachado
    expect(sentEmails).toHaveLength(1);

    // Exactamente 1 token creado en PostgreSQL
    const tokens = await prisma.activationToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(1);
  }, 30_000);
});
