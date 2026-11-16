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

describe('POST /stakeholders/:id/void (PostgreSQL real, HU-021, T-021-27, RF-021, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-stakeholders-void-test',
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

  const voidPost = (id: string, token: string) =>
    request(app).post(`/stakeholders/${id}/void`).set('Authorization', `Bearer ${token}`);

  it('voids with a reason and keeps the record (CA3)', async () => {
    const id = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Elena Quispe',
      dni: '44556611',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await voidPost(id, member.token).send({
      reason: '  Constituyente solicito su retiro del registro  ',
    });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const dto = stakeholderDtoSchema.parse(response.body);
    expect(dto.status).toBe('VOIDED');
    expect(dto.voidReason).toBe('Constituyente solicito su retiro del registro');
    expect(dto.voidedAt).not.toBeNull();
    expect(dto.voidedBy).toBe(member.user.id);
  }, 5_000);

  it('never deletes the row and keeps it searchable', async () => {
    const id = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Mario Vega',
      dni: '44556622',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await voidPost(id, member.token).send({
      reason: 'Motivo valido para mantener historial de participacion',
    });
    expect(response.status).toBe(200);

    const row = await prisma.stakeholder.findUnique({ where: { id } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe('VOIDED');
  }, 5_000);

  it('writes one VOID audit event with before and after', async () => {
    const id = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Rosa Perez',
      dni: '44556633',
      email: 'rosa@example.com',
      mobile: '987654321',
    });
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await voidPost(id, president.token).send({
      reason: 'Anulacion auditada sin exposicion de datos personales',
    });
    expect(response.status).toBe(200);

    const events = await prisma.auditLog.findMany({ where: { entity: 'Stakeholder' } });
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe('VOID');
    expect(events[0]?.before).toMatchObject({ status: 'ACTIVE', hasEmail: true });
    expect(events[0]?.after).toMatchObject({ status: 'VOIDED', hasEmail: true });
    expect(JSON.stringify(events[0]?.after)).not.toContain('rosa@example.com');
  }, 5_000);

  it('returns 409 when the stakeholder is already voided', async () => {
    const id = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      dni: '44556644',
      status: 'VOIDED',
      voidReason: 'Anulado previamente para probar 409',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await voidPost(id, member.token).send({
      reason: 'Segundo intento de anulacion con motivo valido',
    });

    expect(response.status).toBe(409);
    expect(await prisma.auditLog.count({ where: { entity: 'Stakeholder' } })).toBe(0);
  }, 5_000);

  it('returns 404 for an unknown id', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await voidPost('missing-id', member.token).send({
      reason: 'Motivo valido para registro inexistente',
    });

    expect(response.status).toBe(404);
    expect(await prisma.auditLog.count({ where: { entity: 'Stakeholder' } })).toBe(0);
  }, 5_000);

  it('rejects a reason shorter than the minimum, longer than the maximum and unknown fields', async () => {
    const id = await createStakeholderRow(prisma, { kind: 'PERSON', dni: '44556655' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    expect((await voidPost(id, member.token).send({ reason: 'corto' })).status).toBe(400);
    expect((await voidPost(id, member.token).send({ reason: 'x'.repeat(501) })).status).toBe(400);
    expect(
      (
        await voidPost(id, member.token).send({
          reason: 'Motivo valido con campo extra',
          extra: 'hostile',
        })
      ).status,
    ).toBe(400);
  }, 5_000);

  it('rejects an id longer than the maximum', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await voidPost('x'.repeat(65), member.token).send({
      reason: 'Motivo valido para id demasiado largo',
    });

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app)
      .post('/stakeholders/stk-1/void')
      .send({ reason: 'Motivo valido sin token de autenticacion' });

    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 and records ACCESS_DENIED without constituyente.editar', async () => {
    const id = await createStakeholderRow(prisma, { kind: 'PERSON', dni: '44556666' });
    const teacher = await createActor(['TEACHER']);

    const response = await voidPost(id, teacher.token).send({
      reason: 'Intento de anulacion sin permiso de edicion',
    });

    expect(response.status).toBe(403);
    const denied = await prisma.auditLog.findMany({
      where: { action: 'ACCESS_DENIED', actor: teacher.user.id },
    });
    expect(denied).toHaveLength(1);
  }, 5_000);

  it('returns 403 for a read-only role', async () => {
    const id = await createStakeholderRow(prisma, { kind: 'PERSON', dni: '44556677' });
    const director = await createActor(['PROGRAM_DIRECTOR']);

    const response = await voidPost(id, director.token).send({
      reason: 'Intento de anulacion por director sin permiso de edicion',
    });

    expect(response.status).toBe(403);
  }, 5_000);

  it('lets exactly one of N concurrent voids win', async () => {
    const id = await createStakeholderRow(prisma, { kind: 'PERSON', dni: '44556688' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        voidPost(id, member.token).send({
          reason: `Motivo de anulacion concurrente numero ${index + 1}`,
        }),
      ),
    );

    const winners = responses.filter((res) => res.status === 200);
    expect(winners).toHaveLength(1);
    expect(responses.filter((res) => res.status === 409)).toHaveLength(4);

    const winnerDto = stakeholderDtoSchema.parse(winners[0]!.body);
    const row = await prisma.stakeholder.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('VOIDED');
    expect(row.voidReason).toBe(winnerDto.voidReason);
    expect(await prisma.auditLog.count({ where: { entity: 'Stakeholder', action: 'VOID' } })).toBe(
      1,
    );
  }, 5_000);
});
