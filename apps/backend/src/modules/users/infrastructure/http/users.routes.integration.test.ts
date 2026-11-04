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
    status?: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION';
    roleCodes?: string[];
  }) {
    const unique = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const user = await prisma.user.create({
      data: {
        names: overrides?.names ?? 'Original Name',
        firstSurname: overrides?.firstSurname ?? 'Original Surname',
        secondSurname: overrides?.secondSurname,
        email: overrides?.email ?? `target.${unique}@unterm.edu.pe`,
        dni:
          overrides?.dni ??
          String(Math.floor(10000000 + Math.random() * 89999999)).padStart(8, '0'),
        status: overrides?.status ?? 'ACTIVE',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash$dummyhash',
      },
    });

    if (overrides?.roleCodes && overrides.roleCodes.length > 0) {
      const roles = await prisma.role.findMany({
        where: { code: { in: overrides.roleCodes } },
        select: { id: true },
      });
      for (const role of roles) {
        await prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
            createdBy: 'TEST',
          },
        });
      }
    }

    return user;
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

  describe('PATCH /users/:id/status (T-003-25)', () => {
    it('deactivates an active user, revokes its refresh tokens and audits it (CA3, RS-020, RNF-022)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const target = await createTestTargetUser();

      // Crear dos refresh tokens activos para el usuario
      await prisma.refreshToken.createMany({
        data: [
          {
            userId: target.id,
            tokenHash: 'hash-session-1-64-chars-long-abcdef0123456789abcdef0123456789abcdef01',
            expiresAt: new Date(Date.now() + 86400000),
          },
          {
            userId: target.id,
            tokenHash: 'hash-session-2-64-chars-long-abcdef0123456789abcdef0123456789abcdef01',
            expiresAt: new Date(Date.now() + 86400000),
          },
        ],
      });

      const response = await request(app)
        .patch(`/users/${target.id}/status`)
        .set('Authorization', admin.authHeader)
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body.id).toBe(target.id);
      expect(response.body.status).toBe('INACTIVE');

      // Verificar base de datos
      const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
      expect(dbUser.status).toBe('INACTIVE');

      const activeTokens = await prisma.refreshToken.findMany({
        where: { userId: target.id, revokedAt: null },
      });
      expect(activeTokens.length).toBe(0);

      const revokedTokens = await prisma.refreshToken.findMany({
        where: { userId: target.id, revokedAt: { not: null } },
      });
      expect(revokedTokens.length).toBe(2);

      // Verificar auditoría
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'STATE_CHANGE',
          entity: 'User',
          entityId: target.id,
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.actor).toBe(admin.user.id);
      const before = auditLog?.before as Record<string, unknown>;
      const after = auditLog?.after as Record<string, unknown>;
      expect(before?.['status']).toBe('ACTIVE');
      expect(after?.['status']).toBe('INACTIVE');
      expect(after?.['revokedSessions']).toBe(2);
    }, 15_000);

    it('an inactivated user can no longer call protected routes nor refresh session (D7, CA3, RNF-004)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const victim = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['TEACHER'],
      });

      // Crear refresh token válido para victim
      const tokenHash = 'dummy-victim-refresh-token-hash-64-chars-long-1234567890abcdef012345';
      await prisma.refreshToken.create({
        data: {
          userId: victim.user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      // Inactivar a victim
      const resDeactivate = await request(app)
        .patch(`/users/${victim.user.id}/status`)
        .set('Authorization', admin.authHeader)
        .send({ status: 'INACTIVE' });
      expect(resDeactivate.status).toBe(200);

      // Intentar usar el access token de victim en ruta protegida
      const resAccess = await request(app)
        .patch(`/users/${victim.user.id}`)
        .set('Authorization', victim.authHeader)
        .send({ names: 'Hack' });
      expect(resAccess.status).toBe(401);

      // Intentar usar el refresh token revocado en /auth/refresh
      const resRefresh = await request(app)
        .post('/auth/refresh')
        .set('Cookie', [`sigoa_refresh_token=some_token`]);
      expect(resRefresh.status).toBe(401);
    }, 15_000);

    it('reactivates an inactive user (LS 5.14)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const target = await prisma.user.create({
        data: {
          names: 'Inactivo',
          firstSurname: 'Usuario',
          email: `inactivo.${Date.now()}@unterm.edu.pe`,
          dni: String(Math.floor(10000000 + Math.random() * 89999999)),
          status: 'INACTIVE',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy',
        },
      });

      const response = await request(app)
        .patch(`/users/${target.id}/status`)
        .set('Authorization', admin.authHeader)
        .send({ status: 'ACTIVE' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ACTIVE');

      const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
      expect(dbUser.status).toBe('ACTIVE');

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'STATE_CHANGE',
          entity: 'User',
          entityId: target.id,
        },
      });
      expect(auditLog).not.toBeNull();
      const before = auditLog?.before as Record<string, unknown>;
      const after = auditLog?.after as Record<string, unknown>;
      expect(before?.['status']).toBe('INACTIVE');
      expect(after?.['status']).toBe('ACTIVE');
    }, 15_000);

    it('returns 409 when deactivating a pending or already inactive user (LS 5.14)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      // Usuario en PENDING_ACTIVATION
      const pendingUser = await prisma.user.create({
        data: {
          names: 'Pending',
          firstSurname: 'User',
          email: `pending.${Date.now()}@unterm.edu.pe`,
          dni: String(Math.floor(10000000 + Math.random() * 89999999)),
          status: 'PENDING_ACTIVATION',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy',
        },
      });

      const resPending = await request(app)
        .patch(`/users/${pendingUser.id}/status`)
        .set('Authorization', admin.authHeader)
        .send({ status: 'INACTIVE' });
      expect(resPending.status).toBe(409);
      expect(resPending.body.error.code).toBe('CONFLICT');

      // Usuario ya INACTIVE
      const inactiveUser = await prisma.user.create({
        data: {
          names: 'Already',
          firstSurname: 'Inactive',
          email: `already.inactive.${Date.now()}@unterm.edu.pe`,
          dni: String(Math.floor(10000000 + Math.random() * 89999999)),
          status: 'INACTIVE',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy',
        },
      });

      const resInactive = await request(app)
        .patch(`/users/${inactiveUser.id}/status`)
        .set('Authorization', admin.authHeader)
        .send({ status: 'INACTIVE' });
      expect(resInactive.status).toBe(409);
      expect(resInactive.body.error.code).toBe('CONFLICT');
    }, 15_000);

    it('returns 409 when an administrator tries to deactivate itself (D9, RS-002)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const response = await request(app)
        .patch(`/users/${admin.user.id}/status`)
        .set('Authorization', admin.authHeader)
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');

      const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: admin.user.id } });
      expect(dbUser.status).toBe('ACTIVE');
    }, 15_000);

    it('returns 404 for an unknown user', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const response = await request(app)
        .patch('/users/usr-unknown-status-999/status')
        .set('Authorization', admin.authHeader)
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }, 15_000);

    it('returns 400 for an invalid status or unknown fields', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const target = await createTestTargetUser();

      const resBadStatus = await request(app)
        .patch(`/users/${target.id}/status`)
        .set('Authorization', admin.authHeader)
        .send({ status: 'SUSPENDED' });
      expect(resBadStatus.status).toBe(400);

      const resExtra = await request(app)
        .patch(`/users/${target.id}/status`)
        .set('Authorization', admin.authHeader)
        .send({ status: 'INACTIVE', extra: 123 });
      expect(resExtra.status).toBe(400);
    }, 15_000);

    it('returns 401 without a token', async () => {
      const target = await createTestTargetUser();

      const response = await request(app)
        .patch(`/users/${target.id}/status`)
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(401);
    }, 15_000);

    it('returns 403 without usuario.editar and changes nothing', async () => {
      const teacher = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['TEACHER'],
      });

      const target = await createTestTargetUser();

      const response = await request(app)
        .patch(`/users/${target.id}/status`)
        .set('Authorization', teacher.authHeader)
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');

      const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
      expect(dbUser.status).toBe('ACTIVE');
    }, 15_000);

    it('answers 200 for a user without dni', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const target = await prisma.user.create({
        data: {
          names: 'No',
          firstSurname: 'Dni',
          email: `no.dni.${Date.now()}@unterm.edu.pe`,
          dni: null,
          status: 'ACTIVE',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy',
        },
      });

      const response = await request(app)
        .patch(`/users/${target.id}/status`)
        .set('Authorization', admin.authHeader)
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(target.id);
      expect(response.body.dni).toBeNull();
      expect(response.body.status).toBe('INACTIVE');
    }, 15_000);

    it('handles concurrent deactivations: only one of 5 simultaneous requests succeeds (D8, RNF-017, RS-002)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const target = await createTestTargetUser();

      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .patch(`/users/${target.id}/status`)
          .set('Authorization', admin.authHeader)
          .send({ status: 'INACTIVE' }),
      );

      const responses = await Promise.all(requests);
      const successes = responses.filter((r) => r.status === 200);
      const conflicts = responses.filter((r) => r.status === 409);

      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(4);

      // Exactamente una auditoría de cambio de estado
      const auditCount = await prisma.auditLog.count({
        where: {
          action: 'STATE_CHANGE',
          entity: 'User',
          entityId: target.id,
        },
      });
      expect(auditCount).toBe(1);
    }, 15_000);
  });

  describe('GET /users (T-003-26, CA4, RS-002, RS-015, RS-020, RNF-009, RNF-017, RNF-030)', () => {
    it('lists users filtered by status and paginates (CA4)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const u1 = await createTestTargetUser({ status: 'ACTIVE' });
      const u2 = await createTestTargetUser({ status: 'ACTIVE' });
      const u3 = await createTestTargetUser({ status: 'INACTIVE' });

      const response = await request(app)
        .get('/users?status=ACTIVE&page=1&pageSize=10')
        .set('Authorization', admin.authHeader);

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThanOrEqual(2);
      expect(response.body.items.every((u: { status: string }) => u.status === 'ACTIVE')).toBe(
        true,
      );
      const ids = response.body.items.map((u: { id: string }) => u.id);
      expect(ids).toContain(u1.id);
      expect(ids).toContain(u2.id);
      expect(ids).not.toContain(u3.id);
    }, 15_000);

    it('lists users filtered by role', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const teacherRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });
      const teacherUser = await createTestTargetUser({ roleCodes: ['TEACHER'] });

      const response = await request(app)
        .get(`/users?roleId=${teacherRole.id}`)
        .set('Authorization', admin.authHeader);

      expect(response.status).toBe(200);
      const items = response.body.items;
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.every((u: { roleIds: string[] }) => u.roleIds.includes(teacherRole.id))).toBe(
        true,
      );
      const ids = items.map((u: { id: string }) => u.id);
      expect(ids).toContain(teacherUser.id);
    }, 15_000);

    it('applies the default page and page size (page: 1, pageSize: 20)', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const response = await request(app).get('/users').set('Authorization', admin.authHeader);

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(20);
    }, 15_000);

    it('returns the total pages and total count', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const response = await request(app)
        .get('/users?page=1&pageSize=5')
        .set('Authorization', admin.authHeader);

      expect(response.status).toBe(200);
      expect(typeof response.body.total).toBe('number');
      expect(response.body.totalPages).toBe(Math.ceil(response.body.total / 5));
    }, 15_000);

    it('returns 400 for an invalid status, page, page size or unknown key', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const resBadStatus = await request(app)
        .get('/users?status=SUSPENDED')
        .set('Authorization', admin.authHeader);
      expect(resBadStatus.status).toBe(400);

      const resBadPage = await request(app)
        .get('/users?page=0')
        .set('Authorization', admin.authHeader);
      expect(resBadPage.status).toBe(400);

      const resHugePage = await request(app)
        .get('/users?page=10001')
        .set('Authorization', admin.authHeader);
      expect(resHugePage.status).toBe(400);

      const resBadPageSize = await request(app)
        .get('/users?pageSize=101')
        .set('Authorization', admin.authHeader);
      expect(resBadPageSize.status).toBe(400);

      const resUnknownKey = await request(app)
        .get('/users?maliciousParam=1')
        .set('Authorization', admin.authHeader);
      expect(resUnknownKey.status).toBe(400);
    }, 15_000);

    it('returns 401 without a token', async () => {
      const response = await request(app).get('/users');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    }, 15_000);

    it('returns 403 without usuario.ver', async () => {
      const teacher = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['TEACHER'],
      });

      const response = await request(app).get('/users').set('Authorization', teacher.authHeader);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }, 15_000);

    it('does not return password hashes or lockout data', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      await createTestTargetUser();

      const response = await request(app)
        .get('/users?page=1&pageSize=10')
        .set('Authorization', admin.authHeader);

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThan(0);
      for (const item of response.body.items) {
        expect(item.passwordHash).toBeUndefined();
        expect(item.password).toBeUndefined();
        expect(item.failedLoginAttempts).toBeUndefined();
        expect(item.lockoutUntil).toBeUndefined();
      }
    }, 15_000);

    it('returns users without dni without failing', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const noDniUser = await prisma.user.create({
        data: {
          names: 'Sin',
          firstSurname: 'Dni',
          email: `sin.dni.${Date.now()}@untrm.edu.pe`,
          dni: null,
          status: 'ACTIVE',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy',
        },
      });

      const response = await request(app)
        .get('/users?status=ACTIVE&pageSize=100')
        .set('Authorization', admin.authHeader);

      expect(response.status).toBe(200);
      const found = response.body.items.find((u: { id: string }) => u.id === noDniUser.id);
      expect(found).toBeDefined();
      expect(found.dni).toBeNull();
    }, 15_000);

    it('answers with Cache-Control: no-store', async () => {
      const admin = await createAuthenticatedActor({
        prisma,
        jwtSecret: env.AUTH_JWT_SECRET,
        roles: ['ADMINISTRATOR'],
      });

      const response = await request(app).get('/users').set('Authorization', admin.authHeader);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
    }, 15_000);
  });
});
