import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { createAuthorizationServices } from '../../index.js';
import type { ResourceOwnershipResolver } from '../../domain/ports/resource-ownership-resolver.js';
import { seedAuthorization, grantRole } from '../../../../test/factories/authorization.js';

describe('Resource Ownership Authorization Probe Integration (PostgreSQL real, HU-008, CA2, RS-011, RF-008, D5, D6)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);

  const env = createTestEnv({
    TRUST_PROXY: 1,
  });

  /**
   * Resolvedor de sonda (D6): utiliza la tabla real `users` de la BD de pruebas
   * como recurso con dueño (un docente es «dueño» cuando el id del recurso coincide con su id,
   * o `NOT_OWNER` cuando pertenece a otro usuario registrado, o `NOT_FOUND` si no existe).
   */
  const probeMeasurementOwnershipResolver: ResourceOwnershipResolver = {
    resourceType: 'CourseMeasurementProbe',
    async resolveOwnership(actorId: string, resourceId: string) {
      const record = await uow.get().user.findUnique({
        where: { id: resourceId },
        select: { id: true },
      });
      if (!record) {
        return 'NOT_FOUND';
      }
      return record.id === actorId ? 'OWNER' : 'NOT_OWNER';
    },
  };

  const authorizationServices = createAuthorizationServices({
    dbProvider: uow,
    unitOfWork: uow,
    auditLogger: auditServices.auditLogger,
    ownershipResolvers: [probeMeasurementOwnershipResolver],
  });

  const app = createApp({
    env,
    setupRoutes: (instance) => {
      instance.use((req, _res, next) => {
        const actorHeader = req.headers['x-actor-id'];
        if (actorHeader && typeof actorHeader === 'string') {
          const ctx = getRequestContext();
          if (ctx) {
            ctx.actor = actorHeader;
          }
        }
        next();
      });

      instance.get(
        '/probe/course-measurements/:id',
        authorizationServices.requirePermission('medicion.ver', 'OWN'),
        async (req, res, next) => {
          try {
            const actorId = getRequestContext()!.actor!;
            const measurementId = String(req.params.id);
            await authorizationServices.authorizer.assertAllowedOnResource({
              actorId,
              permission: 'medicion.ver',
              resource: {
                type: 'CourseMeasurementProbe',
                id: measurementId,
              },
              meta: {
                method: req.method,
                route: '/probe/course-measurements/:id',
              },
            });
            res.status(200).json({ measurementId, ownerId: measurementId });
          } catch (error) {
            next(error);
          }
        },
      );
    },
  });

  let userSeq = 0;
  async function createFixtureActorWithRole(roleCode: string) {
    userSeq += 1;
    const user = await prisma.user.create({
      data: {
        email: `probe-actor-${userSeq}-${Date.now()}@untrm.edu.pe`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
        names: 'Probe',
        firstSurname: 'Actor',
        dni: String(70000000 + userSeq).padStart(8, '0'),
        status: 'ACTIVE',
      },
    });
    await grantRole(prisma, user.id, roleCode);
    return user;
  }

  beforeEach(async () => {
    await seedAuthorization(prisma);
  });

  it('returns 403 for a teacher requesting a measurement that is not theirs (CA2)', async () => {
    const teacherA = await createFixtureActorWithRole('TEACHER');
    const teacherB = await createFixtureActorWithRole('TEACHER');

    const response = await request(app)
      .get(`/probe/course-measurements/${teacherB.id}`)
      .set('x-actor-id', teacherA.id);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(response.body.error.message).toBe('No tienes permiso para realizar esta acción.');

    const auditRows = await prisma.auditLog.findMany({
      where: {
        actor: teacherA.id,
        action: 'ACCESS_DENIED',
      },
    });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.entity).toBe('Permission');
    expect(auditRows[0]!.entityId).toBe('medicion.ver');
    expect(auditRows[0]!.after).toEqual({
      reason: 'NOT_OWNER',
      requiredScope: 'OWN',
      grantedScope: 'OWN',
      method: 'GET',
      route: '/probe/course-measurements/:id',
      resourceType: 'CourseMeasurementProbe',
      resourceId: teacherB.id,
    });
  }, 15_000);

  it('returns 403 (never 404) when a teacher with OWN scope requests a non-existent measurement to prevent enumeration', async () => {
    const teacher = await createFixtureActorWithRole('TEACHER');

    const response = await request(app)
      .get('/probe/course-measurements/non-existent-measurement-id')
      .set('x-actor-id', teacher.id);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  }, 15_000);

  it('returns 200 when a teacher with OWN scope requests their own measurement', async () => {
    const teacher = await createFixtureActorWithRole('TEACHER');

    const response = await request(app)
      .get(`/probe/course-measurements/${teacher.id}`)
      .set('x-actor-id', teacher.id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      measurementId: teacher.id,
      ownerId: teacher.id,
    });
  }, 15_000);

  it('returns 200 when an actor with GLOBAL scope requests another teacher measurement', async () => {
    const admin = await createFixtureActorWithRole('ADMINISTRATOR');
    const teacher = await createFixtureActorWithRole('TEACHER');

    const response = await request(app)
      .get(`/probe/course-measurements/${teacher.id}`)
      .set('x-actor-id', admin.id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      measurementId: teacher.id,
      ownerId: teacher.id,
    });
  }, 15_000);
});
