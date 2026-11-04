import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorization } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('Users HTTP Routes Integration (PostgreSQL real, CA1-CA7, RS-002, RS-020, RNF-009, RNF-017, RNF-030)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-abc-123456',
  });

  const emailSender = new InMemoryEmailSender();
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
        emailSender,
      });
    },
  });

  beforeEach(async () => {
    emailSender.clear();
    await seedAuthorization(prisma);
  });

  async function getRoleIds(...codes: string[]): Promise<string[]> {
    const roles = await prisma.role.findMany({
      where: { code: { in: codes } },
      select: { id: true },
    });
    return roles.map((r) => r.id);
  }

  async function createTestTargetUser(overrides?: {
    names?: string;
    firstSurname?: string;
    secondSurname?: string;
    email?: string;
    dni?: string;
  }) {
    const unique = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    return prisma.user.create({
      data: {
        names: overrides?.names ?? 'Original Name',
        firstSurname: overrides?.firstSurname ?? 'Original Surname',
        secondSurname: overrides?.secondSurname,
        email: overrides?.email ?? `target.${unique}@unterm.edu.pe`,
        dni:
          overrides?.dni ??
          String(Math.floor(10000000 + Math.random() * 89999999)).padStart(8, '0'),
        status: 'ACTIVE',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash$dummyhash',
      },
    });
  }

  describe('POST /users', () => {
    it('creates a user with PENDING_ACTIVATION, assigns roles, issues activation token and audits action (CA1, CA2, RS-002, RS-020)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const roleIds = await getRoleIds('TEACHER', 'COMMITTEE_MEMBER');
      expect(roleIds.length).toBe(2);

      const unique = Date.now();
      const payload = {
        names: 'Juan Carlos',
        firstSurname: 'Pérez',
        secondSurname: 'Gómez',
        email: `juan.perez.${unique}@unterm.edu.pe`,
        dni: String(Math.floor(10000000 + Math.random() * 89999999)),
        roleIds,
      };

      const response = await request(app)
        .post('/users')
        .set('Authorization', admin.authHeader)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['location']).toBe(`/users/${response.body.id}`);

      const userDto = response.body;
      expect(userDto.id).toBeDefined();
      expect(userDto.names).toBe('Juan Carlos');
      expect(userDto.firstSurname).toBe('Pérez');
      expect(userDto.secondSurname).toBe('Gómez');
      expect(userDto.email).toBe(payload.email.toLowerCase());
      expect(userDto.dni).toBe(payload.dni);
      expect(userDto.status).toBe('PENDING_ACTIVATION');
      expect(userDto.roleIds).toEqual(expect.arrayContaining(roleIds));
      expect(userDto.passwordHash).toBeUndefined();

      // Verificar persistencia en base de datos
      const dbUser = await prisma.user.findUnique({
        where: { id: userDto.id },
        include: { userRoles: true, activationTokens: true },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.status).toBe('PENDING_ACTIVATION');
      expect(dbUser?.userRoles.map((ur) => ur.roleId)).toEqual(expect.arrayContaining(roleIds));
      expect(dbUser?.activationTokens.length).toBe(1);
      const tokenRecord = dbUser!.activationTokens[0]!;
      expect(tokenRecord.tokenHash).toHaveLength(64); // SHA-256 hex
      expect(tokenRecord.usedAt).toBeNull();
      expect(tokenRecord.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Verificar auditoría
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'CREATE',
          entity: 'User',
          entityId: userDto.id,
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.actor).toBe(admin.user.id);

      // Verificar correo de activación
      expect(emailSender.sent.length).toBe(1);
      const sentMsg = emailSender.sent[0]!;
      expect(sentMsg.to).toBe(payload.email.toLowerCase());
      expect(sentMsg.template).toBe('account-activation');
      expect(sentMsg.variables['names']).toBe('Juan Carlos');
      expect(sentMsg.variables['activationUrl']).toContain(`${env.APP_PUBLIC_URL}/activar/`);
    }, 15_000);

    it('returns 409 CONFLICT when email already exists (RS-002)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const roleIds = await getRoleIds('TEACHER');
      const unique = Date.now();
      const existingEmail = `dup.email.${unique}@unterm.edu.pe`;

      await request(app)
        .post('/users')
        .set('Authorization', admin.authHeader)
        .send({
          names: 'Primero',
          firstSurname: 'Usuario',
          email: existingEmail,
          dni: String(Math.floor(10000000 + Math.random() * 89999999)),
          roleIds,
        });

      const response = await request(app)
        .post('/users')
        .set('Authorization', admin.authHeader)
        .send({
          names: 'Segundo',
          firstSurname: 'Usuario',
          email: existingEmail.toUpperCase(),
          dni: String(Math.floor(10000000 + Math.random() * 89999999)),
          roleIds,
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('CONFLICT');
    }, 15_000);

    it('returns 409 CONFLICT when DNI already exists (RS-002)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const roleIds = await getRoleIds('TEACHER');
      const sharedDni = String(Math.floor(10000000 + Math.random() * 89999999));

      await request(app)
        .post('/users')
        .set('Authorization', admin.authHeader)
        .send({
          names: 'Primero',
          firstSurname: 'Usuario',
          email: `unique1.${Date.now()}@unterm.edu.pe`,
          dni: sharedDni,
          roleIds,
        });

      const response = await request(app)
        .post('/users')
        .set('Authorization', admin.authHeader)
        .send({
          names: 'Segundo',
          firstSurname: 'Usuario',
          email: `unique2.${Date.now()}@unterm.edu.pe`,
          dni: sharedDni,
          roleIds,
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    }, 15_000);

    it('returns 400 VALIDATION_ERROR on malformed or invalid body', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const roleIds = await getRoleIds('TEACHER');

      const resShortDni = await request(app)
        .post('/users')
        .set('Authorization', admin.authHeader)
        .send({
          names: 'Carlos',
          firstSurname: 'Ruiz',
          email: 'valid@unterm.edu.pe',
          dni: '1234',
          roleIds,
        });
      expect(resShortDni.status).toBe(400);

      const resBadEmail = await request(app)
        .post('/users')
        .set('Authorization', admin.authHeader)
        .send({
          names: 'Carlos',
          firstSurname: 'Ruiz',
          email: 'not-an-email',
          dni: '87654321',
          roleIds,
        });
      expect(resBadEmail.status).toBe(400);

      const resNoRoles = await request(app)
        .post('/users')
        .set('Authorization', admin.authHeader)
        .send({
          names: 'Carlos',
          firstSurname: 'Ruiz',
          email: 'carlos@unterm.edu.pe',
          dni: '87654321',
          roleIds: [],
        });
      expect(resNoRoles.status).toBe(400);

      const resExtraField = await request(app)
        .post('/users')
        .set('Authorization', admin.authHeader)
        .send({
          names: 'Carlos',
          firstSurname: 'Ruiz',
          email: 'carlos@unterm.edu.pe',
          dni: '87654321',
          roleIds,
          isAdmin: true,
        });
      expect(resExtraField.status).toBe(400);
    }, 15_000);

    it('returns 400 VALIDATION_ERROR when a requested role does not exist', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const response = await request(app)
        .post('/users')
        .set('Authorization', admin.authHeader)
        .send({
          names: 'Carlos',
          firstSurname: 'Ruiz',
          email: `carlos.${Date.now()}@unterm.edu.pe`,
          dni: String(Math.floor(10000000 + Math.random() * 89999999)),
          roleIds: ['role-inexistente-123'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }, 15_000);

    it('returns 401 UNAUTHORIZED when no token is provided or user is inactive', async () => {
      const roleIds = await getRoleIds('TEACHER');

      const resNoToken = await request(app).post('/users').send({
        names: 'Carlos',
        firstSurname: 'Ruiz',
        email: 'carlos@unterm.edu.pe',
        dni: '87654321',
        roleIds,
      });
      expect(resNoToken.status).toBe(401);

      const inactiveActor = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
        status: 'INACTIVE',
      });

      const resInactive = await request(app)
        .post('/users')
        .set('Authorization', inactiveActor.authHeader)
        .send({
          names: 'Carlos',
          firstSurname: 'Ruiz',
          email: 'carlos@unterm.edu.pe',
          dni: '87654321',
          roleIds,
        });
      expect(resInactive.status).toBe(401);
    }, 15_000);

    it('returns 403 FORBIDDEN when authenticated actor lacks usuario.crear permission (RS-002)', async () => {
      const teacher = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['TEACHER'],
      });

      const roleIds = await getRoleIds('TEACHER');

      const response = await request(app)
        .post('/users')
        .set('Authorization', teacher.authHeader)
        .send({
          names: 'Nuevo',
          firstSurname: 'Docente',
          email: `nuevo.${Date.now()}@unterm.edu.pe`,
          dni: String(Math.floor(10000000 + Math.random() * 89999999)),
          roleIds,
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }, 15_000);

    it('remains resilient and creates user (201) even if email sender fails', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const roleIds = await getRoleIds('TEACHER');
      emailSender.simulateFailure = new Error('Proveedor de correo no disponible');

      const unique = Date.now();
      const payload = {
        names: 'Resilient',
        firstSurname: 'User',
        email: `resilient.${unique}@unterm.edu.pe`,
        dni: String(Math.floor(10000000 + Math.random() * 89999999)),
        roleIds,
      };

      const response = await request(app)
        .post('/users')
        .set('Authorization', admin.authHeader)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();

      const dbUser = await prisma.user.findUnique({
        where: { id: response.body.id },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.email).toBe(payload.email);
    }, 15_000);

    it('handles concurrent registrations gracefully: 5 simultaneous requests with the same email result in 1 success (201) and 4 conflicts (409) (RNF-017, RS-002)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const roleIds = await getRoleIds('TEACHER');
      const sharedEmail = `race.${Date.now()}@unterm.edu.pe`;

      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/users')
          .set('Authorization', admin.authHeader)
          .send({
            names: `Nombre ${i}`,
            firstSurname: `Apellido ${i}`,
            email: sharedEmail,
            dni: String(Math.floor(10000000 + Math.random() * 89999999)),
            roleIds,
          }),
      );

      const responses = await Promise.all(requests);
      const successes = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);

      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(4);
      for (const conflict of conflicts) {
        expect(conflict.body.error.code).toBe('CONFLICT');
      }
    }, 15_000);

    it('verifies no public anonymous registration endpoint exists (POST /auth/register returns 404)', async () => {
      const response = await request(app).post('/auth/register').send({
        email: 'anonymous@example.test',
        password: 'Password123!',
      });
      expect(response.status).toBe(404);
    }, 15_000);
  });

  describe('PATCH /users/:id', () => {
    it('updates user profile fields and records UPDATE audit log with before/after snapshots and actor (CA3, RS-002, RS-020)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const target = await createTestTargetUser({
        names: 'Nombre Inicial',
        firstSurname: 'Apellido Inicial',
      });

      const updatePayload = {
        names: 'Nombre Modificado',
        firstSurname: 'Apellido Modificado',
        secondSurname: 'Segundo Modificado',
      };

      const response = await request(app)
        .patch(`/users/${target.id}`)
        .set('Authorization', admin.authHeader)
        .send(updatePayload);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body.id).toBe(target.id);
      expect(response.body.names).toBe('Nombre Modificado');
      expect(response.body.firstSurname).toBe('Apellido Modificado');
      expect(response.body.secondSurname).toBe('Segundo Modificado');

      const updatedUser = await prisma.user.findUniqueOrThrow({
        where: { id: target.id },
      });
      expect(updatedUser.names).toBe('Nombre Modificado');
      expect(updatedUser.firstSurname).toBe('Apellido Modificado');
      expect(updatedUser.secondSurname).toBe('Segundo Modificado');

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'UPDATE',
          entity: 'User',
          entityId: target.id,
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.actor).toBe(admin.user.id);
      const beforeSnapshot = auditLog?.before as Record<string, unknown>;
      const afterSnapshot = auditLog?.after as Record<string, unknown>;
      expect(beforeSnapshot?.['names']).toBe('Nombre Inicial');
      expect(afterSnapshot?.['names']).toBe('Nombre Modificado');
    }, 15_000);

    it('is idempotent and skips audit/save when sent payload contains identical values (D7, RS-020)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const target = await createTestTargetUser({
        names: 'Mismo Nombre',
        firstSurname: 'Mismo Apellido',
      });

      const beforeAuditCount = await prisma.auditLog.count({
        where: { entity: 'User', entityId: target.id },
      });

      const response = await request(app)
        .patch(`/users/${target.id}`)
        .set('Authorization', admin.authHeader)
        .send({
          names: 'Mismo Nombre',
          firstSurname: 'Mismo Apellido',
        });

      expect(response.status).toBe(200);
      expect(response.body.names).toBe('Mismo Nombre');

      const afterAuditCount = await prisma.auditLog.count({
        where: { entity: 'User', entityId: target.id },
      });
      expect(afterAuditCount).toBe(beforeAuditCount);
    }, 15_000);

    it('allows keeping own email or DNI without self-collision', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const target = await createTestTargetUser();

      const response = await request(app)
        .patch(`/users/${target.id}`)
        .set('Authorization', admin.authHeader)
        .send({
          names: 'Nombre Nuevo',
          email: target.email,
          dni: target.dni ?? undefined,
        });

      expect(response.status).toBe(200);
      expect(response.body.names).toBe('Nombre Nuevo');
      expect(response.body.email).toBe(target.email);
    }, 15_000);

    it('returns 409 CONFLICT when trying to change email to an existing one', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const existingUser = await createTestTargetUser();
      const target = await createTestTargetUser();

      const response = await request(app)
        .patch(`/users/${target.id}`)
        .set('Authorization', admin.authHeader)
        .send({
          email: existingUser.email,
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    }, 15_000);

    it('returns 409 CONFLICT when trying to change DNI to an existing one', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const existingUser = await createTestTargetUser();
      const target = await createTestTargetUser();

      const response = await request(app)
        .patch(`/users/${target.id}`)
        .set('Authorization', admin.authHeader)
        .send({
          dni: existingUser.dni ?? '12345678',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    }, 15_000);

    it('returns 400 VALIDATION_ERROR on empty payload', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const target = await createTestTargetUser();

      const response = await request(app)
        .patch(`/users/${target.id}`)
        .set('Authorization', admin.authHeader)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }, 15_000);

    it('returns 400 VALIDATION_ERROR when trying to edit forbidden fields (status, roleIds, isAdmin)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const target = await createTestTargetUser();

      const resStatus = await request(app)
        .patch(`/users/${target.id}`)
        .set('Authorization', admin.authHeader)
        .send({ status: 'INACTIVE' });
      expect(resStatus.status).toBe(400);

      const resRoles = await request(app)
        .patch(`/users/${target.id}`)
        .set('Authorization', admin.authHeader)
        .send({ roleIds: ['role-1'] });
      expect(resRoles.status).toBe(400);

      const resExtra = await request(app)
        .patch(`/users/${target.id}`)
        .set('Authorization', admin.authHeader)
        .send({ names: 'Carlos', isAdmin: true });
      expect(resExtra.status).toBe(400);
    }, 15_000);

    it('returns 404 NOT_FOUND when target user does not exist', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const response = await request(app)
        .patch('/users/usr-non-existent-999')
        .set('Authorization', admin.authHeader)
        .send({ names: 'Cualquiera' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }, 15_000);

    it('returns 401 UNAUTHORIZED when no token is provided', async () => {
      const response = await request(app).patch('/users/user-123').send({ names: 'Cualquiera' });

      expect(response.status).toBe(401);
    }, 15_000);

    it('returns 403 FORBIDDEN when authenticated actor lacks usuario.editar (e.g. TEACHER)', async () => {
      const teacher = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['TEACHER'],
      });

      const target = await createTestTargetUser();

      const response = await request(app)
        .patch(`/users/${target.id}`)
        .set('Authorization', teacher.authHeader)
        .send({ names: 'Modificado' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }, 15_000);
  });
});
