import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { responseScaleDtoSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('POST /response-scales HTTP Routes Integration (PostgreSQL real, HU-012, T-012-24, RF-012, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-response-scales-create-test',
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

  async function createActor(roles: string[]) {
    return createAuthenticatedActor({ prisma, jwtSecret: env.AUTH_JWT_SECRET, roles });
  }

  const level = (label: string, value: number, countsAsAchievement = false) => ({
    label,
    value,
    countsAsAchievement,
  });

  const valid = {
    code: 'EVIDENCE_4',
    name: 'Evidencia 4',
    type: 'EVIDENCE',
    levels: [level('No se evidencia', 1), level('Se evidencia totalmente', 4, true)],
  };

  const auditedCount = () => prisma.auditLog.count({ where: { entity: 'ResponseScale' } });

  describe('Success (201)', () => {
    it('creates the scale with its levels and audits the creation', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/response-scales')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(valid);

      expect(response.status).toBe(201);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = responseScaleDtoSchema.parse(response.body);
      expect(body).toMatchObject({ code: 'EVIDENCE_4', type: 'EVIDENCE', inUse: false });
      expect(body.levels).toEqual([
        { order: 1, label: 'No se evidencia', value: 1, countsAsAchievement: false },
        { order: 2, label: 'Se evidencia totalmente', value: 4, countsAsAchievement: true },
      ]);

      expect(await prisma.scaleLevel.count({ where: { scaleId: body.id } })).toBe(2);
      const events = await prisma.auditLog.findMany({ where: { entity: 'ResponseScale' } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ action: 'CREATE', actor: admin.user.id });
      expect(events[0]?.before).toBeNull();
    });

    it('accepts an incomplete but valid scale: two levels and none counting as achievement', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/response-scales')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ ...valid, code: 'MINIMA', levels: [level('Uno', 1), level('Dos', 2)] });

      expect(response.status).toBe(201);
      expect(
        responseScaleDtoSchema.parse(response.body).levels.some((l) => l.countsAsAchievement),
      ).toBe(false);
    });

    it('trims the code, the name and the labels', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/response-scales')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          ...valid,
          code: '  EVIDENCE_4  ',
          name: '  Evidencia 4  ',
          levels: [level('  Uno ', 1), level(' Dos ', 2)],
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ code: 'EVIDENCE_4', name: 'Evidencia 4' });
      expect(response.body.levels[0].label).toBe('Uno');
    });
  });

  describe('Validation (400)', () => {
    const adminToken = async () => (await createActor(['ADMINISTRATOR'])).token;
    const levelsOf = (count: number) =>
      Array.from({ length: count }, (_, index) => level(`Nivel ${index}`, index));

    it.each([
      ['an extra field', { ...valid, extra: 1 }],
      ['an empty body', {}],
      ['a missing type', { code: valid.code, name: valid.name, levels: valid.levels }],
      ['a type outside the enum', { ...valid, type: 'OTHER' }],
      ['a lowercase code', { ...valid, code: 'evidence' }],
      ['an empty code', { ...valid, code: '' }],
      ['a code with spaces', { ...valid, code: 'EVIDENCE 4' }],
      ['a 5000 character code', { ...valid, code: 'A'.repeat(5000) }],
      ['an empty name', { ...valid, name: '' }],
      ['a 121 character name', { ...valid, name: 'N'.repeat(121) }],
      ['one level', { ...valid, levels: [level('Solo', 1)] }],
      ['eleven levels', { ...valid, levels: levelsOf(11) }],
      ['a null levels list', { ...valid, levels: null }],
      ['a decimal value', { ...valid, levels: [level('A', 13.5), level('B', 2)] }],
      [
        'a string value',
        {
          ...valid,
          levels: [{ label: 'A', value: '3', countsAsAchievement: false }, level('B', 2)],
        },
      ],
      [
        'a null value',
        {
          ...valid,
          levels: [{ label: 'A', value: null, countsAsAchievement: false }, level('B', 2)],
        },
      ],
      ['a negative value', { ...valid, levels: [level('A', -1), level('B', 2)] }],
      ['a value above 100', { ...valid, levels: [level('A', 101), level('B', 2)] }],
      ['repeated values', { ...valid, levels: [level('A', 1), level('B', 1)] }],
      [
        'repeated labels ignoring case',
        { ...valid, levels: [level('Alto', 1), level(' ALTO ', 2)] },
      ],
      ['an empty label', { ...valid, levels: [level('', 1), level('B', 2)] }],
      [
        'a missing counts-as-achievement flag',
        { ...valid, levels: [{ label: 'A', value: 1 }, level('B', 2)] },
      ],
      [
        'a string counts-as-achievement flag',
        {
          ...valid,
          levels: [{ label: 'A', value: 1, countsAsAchievement: 'true' }, level('B', 2)],
        },
      ],
    ])('answers 400 for %s without persisting or auditing', async (_name, payload) => {
      const response = await request(app)
        .post('/response-scales')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(await prisma.responseScale.count()).toBe(0);
      expect(await auditedCount()).toBe(0);
    });

    it('answers 400 for a body that is not an object', async () => {
      const response = await request(app)
        .post('/response-scales')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .send(['a']);
      expect(response.status).toBe(400);
    });

    it('answers 400 for a query with unknown fields', async () => {
      const response = await request(app)
        .post('/response-scales?x=1')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .send(valid);
      expect(response.status).toBe(400);
    });

    it('answers 400 for a body that is not JSON', async () => {
      const response = await request(app)
        .post('/response-scales')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .set('Content-Type', 'application/json')
        .send('{not json');
      expect(response.status).toBe(400);
    });
  });

  describe('Conflict (409)', () => {
    it('answers 409 for a code that already exists and keeps a single scale', async () => {
      const admin = await createActor(['ADMINISTRATOR']);
      const send = () =>
        request(app)
          .post('/response-scales')
          .set('Authorization', `Bearer ${admin.token}`)
          .send(valid);

      expect((await send()).status).toBe(201);
      const again = await send();

      expect(again.status).toBe(409);
      expect(await prisma.responseScale.count()).toBe(1);
      expect(await auditedCount()).toBe(1);
    });
  });

  describe('Authentication & Authorization (401, 403)', () => {
    it('answers 401 without token', async () => {
      const response = await request(app).post('/response-scales').send(valid);
      expect(response.status).toBe(401);
    });

    it.each([[[]], [['TEACHER']], [['COMMITTEE_MEMBER']]])(
      'answers 403 and audits ACCESS_DENIED for roles %j, who lack parametro.editar (RNF-009)',
      async (roles) => {
        const actor = await createActor(roles as string[]);

        const response = await request(app)
          .post('/response-scales')
          .set('Authorization', `Bearer ${actor.token}`)
          .send(valid);

        expect(response.status).toBe(403);
        expect(await prisma.responseScale.count()).toBe(0);
        expect(await auditedCount()).toBe(0);
        const denied = await prisma.auditLog.findFirst({
          where: { action: 'ACCESS_DENIED', actor: actor.user.id },
        });
        expect(denied).not.toBeNull();
      },
    );
  });
});
