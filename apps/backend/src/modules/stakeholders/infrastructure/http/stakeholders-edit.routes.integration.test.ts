import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { stakeholderDtoSchema } from '@sigoa/shared';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createStakeholderRow } from '../../../../test/factories/stakeholders.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { createTestEnv } from '../../../../test/test-env.js';

describe('PATCH /stakeholders/:id (PostgreSQL real, HU-021, T-021-26, RF-021, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-stakeholders-edit-test',
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

  const patch = (id: string, token: string) =>
    request(app).patch(`/stakeholders/${id}`).set('Authorization', `Bearer ${token}`);

  it('updates the data and audits before and after', async () => {
    const id = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Ana Torres',
      dni: '45678912',
      email: 'ana@example.com',
      mobile: '987654321',
      position: 'Egresada',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await patch(id, member.token).send({
      fullName: 'Ana Torres Mendoza',
      position: 'Jefa de TI',
      email: 'Ana.Nueva@Example.com',
    });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const dto = stakeholderDtoSchema.parse(response.body);
    expect(dto).toMatchObject({
      id,
      fullName: 'Ana Torres Mendoza',
      position: 'Jefa de TI',
      email: 'ana.nueva@example.com',
      mobile: '987654321',
      status: 'ACTIVE',
    });

    const events = await prisma.auditLog.findMany({ where: { entity: 'Stakeholder' } });
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe('UPDATE');
    expect(events[0]?.before).toMatchObject({ fullName: 'Ana Torres', hasEmail: true });
    expect(events[0]?.after).toMatchObject({ fullName: 'Ana Torres Mendoza', hasEmail: true });
    expect(JSON.stringify(events[0]?.after)).not.toContain('ana.nueva@example.com');
  }, 5_000);

  it('clears the email with null and keeps the rest', async () => {
    const id = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Luis Diaz',
      dni: '11223344',
      email: 'luis@example.com',
      mobile: '912345678',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await patch(id, member.token).send({ email: null });

    expect(response.status).toBe(200);
    const dto = stakeholderDtoSchema.parse(response.body);
    expect(dto.email).toBeNull();
    expect(dto.mobile).toBe('912345678');
    expect(dto.fullName).toBe('Luis Diaz');
  }, 5_000);

  it('returns 404 for an unknown id', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await patch('non-existent-id', member.token).send({ position: 'Nuevo' });

    expect(response.status).toBe(404);
    expect(await prisma.auditLog.count({ where: { entity: 'Stakeholder' } })).toBe(0);
  }, 5_000);

  it('returns 409 when editing a voided stakeholder', async () => {
    const id = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      dni: '22334455',
      status: 'VOIDED',
      voidReason: 'Anulado previamente para prueba de inmutabilidad',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await patch(id, member.token).send({ position: 'Otro' });

    expect(response.status).toBe(409);
    expect(await prisma.auditLog.count({ where: { entity: 'Stakeholder' } })).toBe(0);
  }, 5_000);

  it('returns 409 when the new DNI belongs to another stakeholder', async () => {
    await createStakeholderRow(prisma, { kind: 'PERSON', dni: '33445566' });
    const idToEdit = await createStakeholderRow(prisma, { kind: 'PERSON', dni: '44556677' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await patch(idToEdit, member.token).send({ dni: '33445566' });

    expect(response.status).toBe(409);
    expect(await prisma.auditLog.count({ where: { entity: 'Stakeholder' } })).toBe(0);
  }, 5_000);

  it('rejects an empty body, kind and fields foreign to the kind', async () => {
    const personId = await createStakeholderRow(prisma, { kind: 'PERSON', dni: '55667788' });
    const instId = await createStakeholderRow(prisma, { kind: 'INSTITUTION', ruc: '20556677889' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    expect((await patch(personId, member.token).send({})).status).toBe(400);
    expect((await patch(personId, member.token).send({ kind: 'INSTITUTION' })).status).toBe(400);
    expect((await patch(personId, member.token).send({ ruc: '20123456789' })).status).toBe(400);
    expect((await patch(instId, member.token).send({ graduationYear: 2020 })).status).toBe(400);
  }, 5_000);

  it('rejects an id longer than the maximum', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await patch('x'.repeat(65), member.token).send({ position: 'Otro' });

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 403 and records ACCESS_DENIED without constituyente.editar', async () => {
    const id = await createStakeholderRow(prisma, { kind: 'PERSON', dni: '66778899' });
    const teacher = await createActor(['TEACHER']);

    const response = await patch(id, teacher.token).send({ position: 'Otro' });

    expect(response.status).toBe(403);
    const denied = await prisma.auditLog.findMany({
      where: { action: 'ACCESS_DENIED', actor: teacher.user.id },
    });
    expect(denied).toHaveLength(1);
  }, 5_000);

  it('returns 403 for a read-only role', async () => {
    const id = await createStakeholderRow(prisma, { kind: 'PERSON', dni: '77889900' });
    const director = await createActor(['PROGRAM_DIRECTOR']);

    const response = await patch(id, director.token).send({ position: 'Otro' });

    expect(response.status).toBe(403);
  }, 5_000);

  it('lets exactly one of N concurrent edits claim the same document win', async () => {
    const ids = await Promise.all([
      createStakeholderRow(prisma, { kind: 'PERSON', dni: '88000001' }),
      createStakeholderRow(prisma, { kind: 'PERSON', dni: '88000002' }),
      createStakeholderRow(prisma, { kind: 'PERSON', dni: '88000003' }),
      createStakeholderRow(prisma, { kind: 'PERSON', dni: '88000004' }),
      createStakeholderRow(prisma, { kind: 'PERSON', dni: '88000005' }),
    ]);
    const member = await createActor(['COMMITTEE_MEMBER']);

    const responses = await Promise.all(
      ids.map((id) => patch(id, member.token).send({ dni: '99112233' })),
    );

    expect(responses.filter((res) => res.status === 200)).toHaveLength(1);
    expect(responses.filter((res) => res.status === 409)).toHaveLength(4);
    expect(await prisma.stakeholder.count({ where: { dni: '99112233' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entity: 'Stakeholder' } })).toBe(1);
  }, 5_000);
});
