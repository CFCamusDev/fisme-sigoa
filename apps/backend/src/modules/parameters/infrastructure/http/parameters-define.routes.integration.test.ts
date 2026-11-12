import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { parametersResponseSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaAuditChainReader } from '../../../../shared/prisma/prisma-audit-chain-reader.js';
import { AuditChainVerifier } from '../../../../shared/audit/audit-chain-verifier.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { seedParameterDefaults } from '../prisma/seed/parameter-seed.js';

describe('POST /parameters HTTP Routes Integration (PostgreSQL real, HU-011, T-011-19, CA2, CA3, RF-011, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-parameters-define-test',
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
    await seedParameterDefaults(prisma);
    await prisma.semester.createMany({
      data: [
        {
          code: '2026-II',
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
        },
        {
          code: '2027-I',
          startDate: new Date('2027-03-01T00:00:00.000Z'),
          endDate: new Date('2027-07-31T00:00:00.000Z'),
        },
      ],
    });
  });

  async function createActor(roles: string[]) {
    return createAuthenticatedActor({ prisma, jwtSecret: env.AUTH_JWT_SECRET, roles });
  }

  const valid = { semesterCode: '2027-I', values: [{ key: 'UMBRAL_LOGRADO', value: 15 }] };

  describe('Success (201)', () => {
    it('creates a version from 2027-I, audits before and after and keeps earlier semesters (CA2)', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/parameters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(valid);

      expect(response.status).toBe(201);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = parametersResponseSchema.parse(response.body);
      expect(body.semesterCode).toBe('2027-I');
      expect(body.items.find((i) => i.key === 'UMBRAL_LOGRADO')).toMatchObject({
        value: 15,
        effectiveFromSemesterCode: '2027-I',
      });

      const events = await prisma.auditLog.findMany({
        where: { action: 'PARAMETER_CHANGE', entity: 'Parameter' },
      });
      expect(events).toHaveLength(1);
      expect(events[0]?.actor).toBe(admin.user.id);
      expect(events[0]?.before).toBeNull();
      expect(events[0]?.after).toEqual({
        key: 'UMBRAL_LOGRADO',
        value: 15,
        effectiveFrom: '2027-I',
      });

      const earlier = await request(app)
        .get('/parameters?semesterCode=2026-II')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(earlier.status).toBe(200);
      expect(
        parametersResponseSchema.parse(earlier.body).items.find((i) => i.key === 'UMBRAL_LOGRADO')
          ?.value,
      ).toBe(14);
    });

    it('accepts a weights pair that adds up to 100 (CA3)', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/parameters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          semesterCode: '2027-I',
          values: [
            { key: 'PESO_DIRECTA', value: 60 },
            { key: 'PESO_INDIRECTA', value: 40 },
          ],
        });

      expect(response.status).toBe(201);
      expect(await prisma.auditLog.count({ where: { action: 'PARAMETER_CHANGE' } })).toBe(2);
    });

    it('replaces the value when the same key and semester are defined again', async () => {
      const admin = await createActor(['ADMINISTRATOR']);
      const send = (value: number) =>
        request(app)
          .post('/parameters')
          .set('Authorization', `Bearer ${admin.token}`)
          .send({ semesterCode: '2027-I', values: [{ key: 'META_AG', value }] });

      expect((await send(80)).status).toBe(201);
      const second = await send(85);

      expect(second.status).toBe(201);
      const rows = await prisma.parameter.findMany({ where: { key: 'META_AG' } });
      expect(rows).toHaveLength(2);
      const events = await prisma.auditLog.findMany({
        where: { action: 'PARAMETER_CHANGE' },
        orderBy: { sequence: 'asc' },
      });
      expect(events[1]?.before).toEqual({ key: 'META_AG', value: 80 });
      expect(events[1]?.after).toEqual({ key: 'META_AG', value: 85, effectiveFrom: '2027-I' });
    });

    it('answers 201 without new events when the same value is defined again (incomplete but valid)', async () => {
      const admin = await createActor(['ADMINISTRATOR']);
      const send = () =>
        request(app)
          .post('/parameters')
          .set('Authorization', `Bearer ${admin.token}`)
          .send({ semesterCode: '2027-I', values: [{ key: 'TOKEN_DIAS', value: 10 }] });

      await send();
      const again = await send();

      expect(again.status).toBe(201);
      expect(await prisma.auditLog.count({ where: { action: 'PARAMETER_CHANGE' } })).toBe(1);
    });
  });

  describe('Validation (400)', () => {
    const adminToken = async () => (await createActor(['ADMINISTRATOR'])).token;

    it.each([
      ['an extra field', { ...valid, extra: 1 }],
      ['an empty body', {}],
      ['empty values', { ...valid, values: [] }],
      [
        'eight values',
        { ...valid, values: Array.from({ length: 8 }, () => ({ key: 'META_AG', value: 70 })) },
      ],
      [
        'repeated keys',
        {
          ...valid,
          values: [
            { key: 'META_AG', value: 70 },
            { key: 'META_AG', value: 71 },
          ],
        },
      ],
      ['a key outside the catalog', { ...valid, values: [{ key: 'OTRA', value: 1 }] }],
      ['a lowercase key', { ...valid, values: [{ key: 'meta_ag', value: 1 }] }],
      ['a decimal value', { ...valid, values: [{ key: 'UMBRAL_LOGRADO', value: 13.5 }] }],
      ['a string value', { ...valid, values: [{ key: 'UMBRAL_LOGRADO', value: '14' }] }],
      ['a null value', { ...valid, values: [{ key: 'UMBRAL_LOGRADO', value: null }] }],
      ['a negative value', { ...valid, values: [{ key: 'UMBRAL_LOGRADO', value: -1 }] }],
      ['21 for UMBRAL_LOGRADO', { ...valid, values: [{ key: 'UMBRAL_LOGRADO', value: 21 }] }],
      ['101 for a weight', { ...valid, values: [{ key: 'PESO_DIRECTA', value: 101 }] }],
      ['a single weight', { ...valid, values: [{ key: 'PESO_DIRECTA', value: 70 }] }],
      [
        'weights 70 + 40 (CA3)',
        {
          ...valid,
          values: [
            { key: 'PESO_DIRECTA', value: 70 },
            { key: 'PESO_INDIRECTA', value: 40 },
          ],
        },
      ],
      ['a malformed semester', { ...valid, semesterCode: '2027-III' }],
      ['an empty semester', { ...valid, semesterCode: '' }],
      ['a 5000 character semester', { ...valid, semesterCode: 'x'.repeat(5000) }],
    ])('answers 400 for %s without persisting or auditing', async (_name, payload) => {
      const response = await request(app)
        .post('/parameters')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(
        await prisma.parameter.count({ where: { effectiveFromSemesterId: { not: null } } }),
      ).toBe(0);
      expect(await prisma.auditLog.count({ where: { action: 'PARAMETER_CHANGE' } })).toBe(0);
    });

    it('answers 400 for a query with unknown fields', async () => {
      const response = await request(app)
        .post('/parameters?x=1')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .send(valid);
      expect(response.status).toBe(400);
    });

    it('answers 400 for a body that is not JSON', async () => {
      const response = await request(app)
        .post('/parameters')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .set('Content-Type', 'application/json')
        .send('{not json');
      expect(response.status).toBe(400);
    });
  });

  describe('Not found (404)', () => {
    it('answers 404 for a semester that does not exist', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/parameters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ ...valid, semesterCode: '2099-I' });

      expect(response.status).toBe(404);
      expect(await prisma.auditLog.count({ where: { action: 'PARAMETER_CHANGE' } })).toBe(0);
    });
  });

  describe('Authentication & Authorization (401, 403)', () => {
    it('answers 401 without token', async () => {
      const response = await request(app).post('/parameters').send(valid);
      expect(response.status).toBe(401);
    });

    it.each([['COMMITTEE_MEMBER'], ['PROGRAM_DIRECTOR'], ['TEACHER']])(
      'answers 403 and audits ACCESS_DENIED for %s, who lacks parametro.editar (RNF-009)',
      async (role) => {
        const actor = await createActor([role]);

        const response = await request(app)
          .post('/parameters')
          .set('Authorization', `Bearer ${actor.token}`)
          .send(valid);

        expect(response.status).toBe(403);
        expect(await prisma.auditLog.count({ where: { action: 'PARAMETER_CHANGE' } })).toBe(0);
        const denied = await prisma.auditLog.findFirst({
          where: { action: 'ACCESS_DENIED', actor: actor.user.id },
        });
        expect(denied).not.toBeNull();
      },
    );
  });

  describe('Concurrency', () => {
    it('serializes 20 simultaneous requests for the same key and semester without 5xx', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const responses = await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          request(app)
            .post('/parameters')
            .set('Authorization', `Bearer ${admin.token}`)
            .send({
              semesterCode: '2027-I',
              values: [{ key: 'UMBRAL_LOGRADO', value: index }],
            }),
        ),
      );

      expect(responses.every((r) => r.status === 201)).toBe(true);
      const semester = await prisma.semester.findUniqueOrThrow({ where: { code: '2027-I' } });
      const rows = await prisma.parameter.findMany({
        where: { key: 'UMBRAL_LOGRADO', effectiveFromSemesterId: semester.id },
      });
      expect(rows).toHaveLength(1);

      const verifier = new AuditChainVerifier(new PrismaAuditChainReader(uow));
      expect((await verifier.verify()).valid).toBe(true);
    }, 15_000);
  });
});
