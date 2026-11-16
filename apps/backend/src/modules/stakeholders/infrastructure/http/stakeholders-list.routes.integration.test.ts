import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { listStakeholdersResponseSchema } from '@sigoa/shared';
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

describe('GET /stakeholders (PostgreSQL real, HU-021, T-021-28, RF-021, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-stakeholders-list-test',
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

  const get = (token: string, query: Record<string, string | number> = {}) =>
    request(app).get('/stakeholders').query(query).set('Authorization', `Bearer ${token}`);

  it('lists stakeholders ordered by name with pagination', async () => {
    await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Carlos Vega',
      dni: '11111113',
    });
    await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Ana Alvarez',
      dni: '11111111',
    });
    await createStakeholderRow(prisma, {
      kind: 'INSTITUTION',
      fullName: 'Boreal Tech SAC',
      ruc: '20111111112',
    });
    const director = await createActor(['PROGRAM_DIRECTOR']);

    const page1 = await get(director.token, { page: 1, pageSize: 2 });
    expect(page1.status).toBe(200);
    const parsed1 = listStakeholdersResponseSchema.parse(page1.body);
    expect(parsed1.total).toBe(3);
    expect(parsed1.totalPages).toBe(2);
    expect(parsed1.items.map((item) => item.fullName)).toEqual(['Ana Alvarez', 'Boreal Tech SAC']);

    const page2 = await get(director.token, { page: 2, pageSize: 2 });
    expect(page2.status).toBe(200);
    const parsed2 = listStakeholdersResponseSchema.parse(page2.body);
    expect(parsed2.items.map((item) => item.fullName)).toEqual(['Carlos Vega']);
  }, 5_000);

  it('filters by kind and status', async () => {
    await createStakeholderRow(prisma, { kind: 'PERSON', dni: '22222221', status: 'ACTIVE' });
    await createStakeholderRow(prisma, {
      kind: 'PERSON',
      dni: '22222222',
      status: 'VOIDED',
      voidReason: 'Anulado para filtro de estado',
    });
    await createStakeholderRow(prisma, { kind: 'INSTITUTION', ruc: '20222222223' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await get(member.token, { kind: 'PERSON', status: 'ACTIVE' });
    expect(response.status).toBe(200);
    const parsed = listStakeholdersResponseSchema.parse(response.body);
    expect(parsed.total).toBe(1);
    expect(parsed.items[0]?.dni).toBe('22222221');
  }, 5_000);

  it('finds the existing record by exact DNI or RUC including voided ones (CA2)', async () => {
    await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Registro Anulado',
      dni: '33333331',
      status: 'VOIDED',
      voidReason: 'Anulado pero localizable por documento',
    });
    await createStakeholderRow(prisma, {
      kind: 'INSTITUTION',
      fullName: 'Empresa Activa SAC',
      ruc: '20333333332',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const byDni = await get(member.token, { document: '33333331' });
    expect(byDni.status).toBe(200);
    const parsedDni = listStakeholdersResponseSchema.parse(byDni.body);
    expect(parsedDni.total).toBe(1);
    expect(parsedDni.items[0]?.status).toBe('VOIDED');

    const byRuc = await get(member.token, { document: '20333333332' });
    expect(byRuc.status).toBe(200);
    const parsedRuc = listStakeholdersResponseSchema.parse(byRuc.body);
    expect(parsedRuc.total).toBe(1);
    expect(parsedRuc.items[0]?.ruc).toBe('20333333332');
  }, 5_000);

  it('treats percent and underscore as literal text in the search', async () => {
    await createStakeholderRow(prisma, {
      kind: 'INSTITUTION',
      fullName: '100% Real_Corp SAC',
      ruc: '20444444441',
    });
    await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Lucia Mendoza',
      dni: '44444442',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const byPercent = await get(member.token, { search: '%' });
    expect(byPercent.status).toBe(200);
    expect(listStakeholdersResponseSchema.parse(byPercent.body).items.map((i) => i.ruc)).toEqual([
      '20444444441',
    ]);

    const byUnderscore = await get(member.token, { search: '_' });
    expect(byUnderscore.status).toBe(200);
    expect(listStakeholdersResponseSchema.parse(byUnderscore.body).items.map((i) => i.ruc)).toEqual(
      ['20444444441'],
    );
  }, 5_000);

  it('returns an empty page when nothing matches', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await get(member.token, { search: 'inexistente' });
    expect(response.status).toBe(200);
    expect(listStakeholdersResponseSchema.parse(response.body)).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
  }, 5_000);

  it('returns null optional fields as null', async () => {
    await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Solo Requeridos',
      dni: '55555551',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await get(member.token);
    expect(response.status).toBe(200);
    const parsed = listStakeholdersResponseSchema.parse(response.body);
    expect(parsed.items[0]?.email).toBeNull();
    expect(parsed.items[0]?.mobile).toBeNull();
    expect(parsed.items[0]?.voidReason).toBeNull();
  }, 5_000);

  it('sends Cache-Control no-store', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await get(member.token);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  }, 5_000);

  it('rejects pageSize above 100, page 0, an over-long search, a malformed document, an unknown kind and unknown parameters', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    expect((await get(member.token, { pageSize: 101 })).status).toBe(400);
    expect((await get(member.token, { page: 0 })).status).toBe(400);
    expect((await get(member.token, { search: 'x'.repeat(101) })).status).toBe(400);
    expect((await get(member.token, { document: '123' })).status).toBe(400);
    expect((await get(member.token, { kind: 'OTHER' })).status).toBe(400);
    expect((await get(member.token, { extra: 'hostile' })).status).toBe(400);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app).get('/stakeholders');
    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 and records ACCESS_DENIED without constituyente.ver', async () => {
    const teacher = await createActor(['TEACHER']);

    const response = await get(teacher.token);

    expect(response.status).toBe(403);
    const denied = await prisma.auditLog.findMany({
      where: { action: 'ACCESS_DENIED', actor: teacher.user.id },
    });
    expect(denied).toHaveLength(1);
  }, 5_000);
});
