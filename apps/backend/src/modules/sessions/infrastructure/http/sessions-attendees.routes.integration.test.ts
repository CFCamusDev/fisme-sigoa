import {
  SESSION_ATTENDEES_MAX,
  SESSION_ATTENDEE_POSITION_MAX_LENGTH,
  sessionAttendeesResponseSchema,
} from '@sigoa/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { createTestEnv } from '../../../../test/test-env.js';

describe('PUT & GET /sessions/:id/attendees (PostgreSQL real, HU-033, T-033-13, RF-033, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-sessions-attendees-routes',
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
    await seedAuthorizationFast(prisma);
  });

  const createActor = (roles: string[]) =>
    createAuthenticatedActor({ prisma, jwtSecret: env.AUTH_JWT_SECRET, roles });

  async function seedDomainData() {
    await prisma.program.create({
      data: {
        id: 'prog-1',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });
    await prisma.catalogVersion.create({
      data: {
        id: 'cv-1',
        programId: 'prog-1',
        number: 1,
        status: 'APPROVED',
      },
    });
    await prisma.processExecution.createMany({
      data: [
        {
          id: 'exec-1',
          programId: 'prog-1',
          type: 'P613',
          name: 'Revisión OE 2026',
          year: 2026,
          catalogVersionId: 'cv-1',
          status: 'PLANNED',
          createdBy: 'seed',
        },
        {
          id: 'exec-closed',
          programId: 'prog-1',
          type: 'P612',
          name: 'Medición OE 2025',
          year: 2025,
          catalogVersionId: 'cv-1',
          status: 'CLOSED',
          createdBy: 'seed',
        },
      ],
    });

    await prisma.stakeholderList.createMany({
      data: [
        {
          id: 'list-1',
          programId: 'prog-1',
          type: 'EMPLOYER',
          year: 2026,
          createdBy: 'seed',
        },
        {
          id: 'list-2',
          programId: 'prog-1',
          type: 'EMPLOYER',
          year: 2025,
          createdBy: 'seed',
        },
      ],
    });

    const members = [
      {
        id: 'mem-1',
        listId: 'list-1',
        name: 'Ana Pérez',
        institution: 'Empresa A',
        pos: 'Analista',
      },
      { id: 'mem-2', listId: 'list-1', name: 'Luis Torres', institution: 'Empresa B', pos: 'Jefe' },
      {
        id: 'mem-other',
        listId: 'list-2',
        name: 'Carlos Ruiz',
        institution: 'Empresa C',
        pos: 'CEO',
      },
    ];

    for (const [index, member] of members.entries()) {
      const stakeholderId = `st-${index + 1}`;
      await prisma.stakeholder.create({
        data: {
          id: stakeholderId,
          kind: 'PERSON',
          fullName: member.name,
          email: `persona${index + 1}@example.test`,
          mobile: `90000000${index + 1}`,
          institution: member.institution,
          position: member.pos,
          createdBy: 'seed',
        },
      });
      await prisma.stakeholderListMember.create({
        data: {
          id: member.id,
          listId: member.listId,
          stakeholderId,
          fullName: member.name,
          email: `persona${index + 1}@example.test`,
          mobile: `90000000${index + 1}`,
          institution: member.institution,
          position: member.pos,
          createdBy: 'seed',
        },
      });
    }

    await prisma.session.create({
      data: {
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        stakeholderListId: 'list-1',
        sessionDate: new Date('2026-11-20T00:00:00.000Z'),
        startTime: '10:00',
        modality: 'IN_PERSON',
        createdBy: 'seed',
      },
    });
    await prisma.sessionExecution.create({
      data: {
        sessionId: 'sess-1',
        processExecutionId: 'exec-1',
        createdBy: 'seed',
      },
    });

    await prisma.session.create({
      data: {
        id: 'sess-no-list',
        stakeholderType: 'EMPLOYER',
        stakeholderListId: null,
        sessionDate: new Date('2026-11-21T00:00:00.000Z'),
        startTime: '11:00',
        modality: 'IN_PERSON',
        createdBy: 'seed',
      },
    });
    await prisma.sessionExecution.create({
      data: {
        sessionId: 'sess-no-list',
        processExecutionId: 'exec-1',
        createdBy: 'seed',
      },
    });

    await prisma.session.create({
      data: {
        id: 'sess-closed',
        stakeholderType: 'EMPLOYER',
        stakeholderListId: 'list-1',
        sessionDate: new Date('2025-11-20T00:00:00.000Z'),
        startTime: '12:00',
        modality: 'IN_PERSON',
        createdBy: 'seed',
      },
    });
    await prisma.sessionExecution.create({
      data: {
        sessionId: 'sess-closed',
        processExecutionId: 'exec-closed',
        createdBy: 'seed',
      },
    });
  }

  it('PUT registers the attendees and returns them', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const res = await request(app)
      .put('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        attendees: [{ listMemberId: 'mem-1', position: 'Gerente de TI' }],
      });

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const parsed = sessionAttendeesResponseSchema.parse(res.body);
    expect(parsed.attendeeCount).toBe(1);
    expect(parsed.items).toEqual([
      {
        listMemberId: 'mem-1',
        fullName: 'Ana Pérez',
        institution: 'Empresa A',
        memberPosition: 'Analista',
        attended: true,
        position: 'Gerente de TI',
      },
      {
        listMemberId: 'mem-2',
        fullName: 'Luis Torres',
        institution: 'Empresa B',
        memberPosition: 'Jefe',
        attended: false,
        position: null,
      },
    ]);

    const incompleteValid = await request(app)
      .put('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        attendees: [{ listMemberId: 'mem-2' }],
      });

    expect(incompleteValid.status).toBe(200);
    const parsedIncomplete = sessionAttendeesResponseSchema.parse(incompleteValid.body);
    expect(parsedIncomplete.attendeeCount).toBe(1);
    expect(parsedIncomplete.items.find((i) => i.listMemberId === 'mem-2')).toMatchObject({
      attended: true,
      position: null,
    });
  }, 5_000);

  it('PUT returns 400 for hostile bodies', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const unknownField = await request(app)
      .put('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ attendees: [], extra: true });
    expect(unknownField.status).toBe(400);

    const missingAttendees = await request(app)
      .put('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({});
    expect(missingAttendees.status).toBe(400);

    const tooMany = await request(app)
      .put('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        attendees: Array.from({ length: SESSION_ATTENDEES_MAX + 1 }, (_, i) => ({
          listMemberId: `mem-${i}`,
        })),
      });
    expect(tooMany.status).toBe(400);

    const repeated = await request(app)
      .put('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        attendees: [{ listMemberId: 'mem-1' }, { listMemberId: 'mem-1' }],
      });
    expect(repeated.status).toBe(400);

    const longPosition = await request(app)
      .put('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        attendees: [
          {
            listMemberId: 'mem-1',
            position: 'x'.repeat(SESSION_ATTENDEE_POSITION_MAX_LENGTH + 1),
          },
        ],
      });
    expect(longPosition.status).toBe(400);

    const longId = await request(app)
      .put(`/sessions/${'a'.repeat(65)}/attendees`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ attendees: [] });
    expect(longId.status).toBe(400);
  }, 5_000);

  it('PUT returns 401 without token', async () => {
    const res = await request(app).put('/sessions/sess-1/attendees').send({ attendees: [] });
    expect(res.status).toBe(401);
  }, 5_000);

  it('PUT returns 403 without sesion.editar', async () => {
    await seedDomainData();
    const director = await createActor(['PROGRAM_DIRECTOR']);

    const res = await request(app)
      .put('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${director.token}`)
      .send({ attendees: [] });

    expect(res.status).toBe(403);
  }, 5_000);

  it('PUT returns 404 for an unknown session', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const res = await request(app)
      .put('/sessions/sess-unknown/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ attendees: [] });

    expect(res.status).toBe(404);
  }, 5_000);

  it('PUT returns 409 for a member outside the session list', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const res = await request(app)
      .put('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ attendees: [{ listMemberId: 'mem-other', position: 'Director' }] });

    expect(res.status).toBe(409);
    expect(String(res.body.error?.message)).toContain('agrégalo primero a la lista');
  }, 5_000);

  it('PUT returns 409 when the session has no list', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const res = await request(app)
      .put('/sessions/sess-no-list/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ attendees: [] });

    expect(res.status).toBe(409);
  }, 5_000);

  it('PUT returns 409 when the execution is closed', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const res = await request(app)
      .put('/sessions/sess-closed/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ attendees: [{ listMemberId: 'mem-1' }] });

    expect(res.status).toBe(409);
  }, 5_000);

  it('PUT with an empty list clears the attendees', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);

    await request(app)
      .put('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ attendees: [{ listMemberId: 'mem-1', position: 'Director' }] })
      .expect(200);

    const cleared = await request(app)
      .put('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ attendees: [] });

    expect(cleared.status).toBe(200);
    expect(cleared.body.attendeeCount).toBe(0);
    expect(cleared.body.items.every((item: { attended: boolean }) => !item.attended)).toBe(true);
  }, 5_000);

  it('handles concurrent identical PUT requests idempotently', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const payload = { attendees: [{ listMemberId: 'mem-1', position: 'Gerente' }] };

    const responses = await Promise.all([
      request(app)
        .put('/sessions/sess-1/attendees')
        .set('Authorization', `Bearer ${member.token}`)
        .send(payload),
      request(app)
        .put('/sessions/sess-1/attendees')
        .set('Authorization', `Bearer ${member.token}`)
        .send(payload),
    ]);

    expect(responses.map((res) => res.status)).toEqual([200, 200]);

    const audits = await prisma.auditLog.findMany({
      where: { entity: 'SessionAttendees', entityId: 'sess-1' },
    });
    expect(audits).toHaveLength(1);
  }, 5_000);

  it('GET returns the roster with attended marks and no personal contact data', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);

    await request(app)
      .put('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ attendees: [{ listMemberId: 'mem-2', position: 'Director TI' }] })
      .expect(200);

    const res = await request(app)
      .get('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const parsed = sessionAttendeesResponseSchema.parse(res.body);
    expect(parsed.attendeeCount).toBe(1);
    for (const item of parsed.items) {
      expect(Object.keys(item).sort()).toEqual([
        'attended',
        'fullName',
        'institution',
        'listMemberId',
        'memberPosition',
        'position',
      ]);
    }

    const unknownQuery = await request(app)
      .get('/sessions/sess-1/attendees?extra=1')
      .set('Authorization', `Bearer ${member.token}`);
    expect(unknownQuery.status).toBe(400);

    const longId = await request(app)
      .get(`/sessions/${'a'.repeat(65)}/attendees`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(longId.status).toBe(400);
  }, 5_000);

  it('GET returns 403 without sesion.ver', async () => {
    await seedDomainData();
    const actorWithoutPerms = await createActor([]);

    const res = await request(app)
      .get('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${actorWithoutPerms.token}`);

    expect(res.status).toBe(403);
  }, 5_000);

  it('GET returns an empty roster when the session has no list', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const res = await request(app)
      .get('/sessions/sess-no-list/attendees')
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sessionId: 'sess-no-list',
      stakeholderListId: null,
      attendeeCount: 0,
      items: [],
    });
  }, 5_000);

  it('PUT returns 409 and leaves attendees and audit untouched when linked execution is voided', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);

    await prisma.processExecution.update({
      where: { id: 'exec-1' },
      data: { status: 'VOIDED' },
    });

    const res = await request(app)
      .put('/sessions/sess-1/attendees')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ attendees: [{ listMemberId: 'mem-1', position: 'Gerente' }] });

    expect(res.status).toBe(409);

    const count = await prisma.sessionAttendee.count({ where: { sessionId: 'sess-1' } });
    expect(count).toBe(0);
    const audits = await prisma.auditLog.findMany({
      where: { entity: 'SessionAttendees', entityId: 'sess-1' },
    });
    expect(audits).toHaveLength(0);
  }, 5_000);
});
