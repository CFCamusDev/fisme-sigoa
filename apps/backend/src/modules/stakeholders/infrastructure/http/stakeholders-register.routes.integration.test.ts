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

describe('POST /stakeholders (PostgreSQL real, HU-021, T-021-25, RF-021, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-stakeholders-register-test',
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

  const post = (token: string) =>
    request(app).post('/stakeholders').set('Authorization', `Bearer ${token}`);

  const personPayload = (overrides: Record<string, unknown> = {}) => ({
    kind: 'PERSON',
    fullName: 'Ana Lucia Torres',
    dni: '45678912',
    email: 'ana.torres@example.com',
    mobile: '987654321',
    position: 'Egresada',
    institution: 'UNTRM',
    sector: 'Educacion',
    graduationYear: 2022,
    cycle: null,
    ...overrides,
  });

  it('registers a person with a DNI and audits it (CA1)', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await post(member.token).send(personPayload());

    expect(response.status).toBe(201);
    const dto = stakeholderDtoSchema.parse(response.body);
    expect(dto).toMatchObject({
      kind: 'PERSON',
      fullName: 'Ana Lucia Torres',
      dni: '45678912',
      ruc: null,
      email: 'ana.torres@example.com',
      mobile: '987654321',
      status: 'ACTIVE',
    });

    const row = await prisma.stakeholder.findUniqueOrThrow({ where: { id: dto.id } });
    expect(row.createdBy).toBe(member.user.id);

    const events = await prisma.auditLog.findMany({ where: { entity: 'Stakeholder' } });
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe('CREATE');
    expect(events[0]?.entityId).toBe(dto.id);
  }, 5_000);

  it('registers an institution with a RUC', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await post(president.token).send({
      kind: 'INSTITUTION',
      fullName: 'Tech Amazonas SAC',
      ruc: '20123456789',
      email: 'contacto@techamazonas.pe',
      position: 'Gerencia TI',
      sector: 'Tecnologia',
    });

    expect(response.status).toBe(201);
    const dto = stakeholderDtoSchema.parse(response.body);
    expect(dto).toMatchObject({
      kind: 'INSTITUTION',
      fullName: 'Tech Amazonas SAC',
      ruc: '20123456789',
      dni: null,
      status: 'ACTIVE',
    });
  }, 5_000);

  it('returns null optional fields for a person with only the required data', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await post(member.token).send({
      kind: 'PERSON',
      fullName: 'Luis Diaz',
      dni: '11223344',
    });

    expect(response.status).toBe(201);
    const dto = stakeholderDtoSchema.parse(response.body);
    expect(dto.email).toBeNull();
    expect(dto.mobile).toBeNull();
    expect(dto.position).toBeNull();
    expect(dto.institution).toBeNull();
    expect(dto.sector).toBeNull();
    expect(dto.graduationYear).toBeNull();
    expect(dto.cycle).toBeNull();
  }, 5_000);

  it('sends Cache-Control no-store', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await post(member.token).send({
      kind: 'PERSON',
      fullName: 'Rosa Perez',
      dni: '22334455',
    });

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
  }, 5_000);

  it('never stores email or mobile in the audit event', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await post(member.token).send(
      personPayload({
        dni: '33445566',
        email: 'secreto@example.com',
        mobile: '999888777',
      }),
    );

    expect(response.status).toBe(201);
    const events = await prisma.auditLog.findMany({ where: { entity: 'Stakeholder' } });
    expect(events).toHaveLength(1);
    const serialized = JSON.stringify(events[0]?.after);
    expect(serialized).not.toContain('secreto@example.com');
    expect(serialized).not.toContain('999888777');
    expect(events[0]?.after).toMatchObject({ hasEmail: true, hasMobile: true });
  }, 5_000);

  it('returns 409 for a duplicate DNI or RUC (CA2)', async () => {
    await createStakeholderRow(prisma, { kind: 'PERSON', dni: '44556677' });
    await createStakeholderRow(prisma, { kind: 'INSTITUTION', ruc: '20987654321' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const dupDni = await post(member.token).send(personPayload({ dni: '44556677' }));
    expect(dupDni.status).toBe(409);

    const dupRuc = await post(member.token).send({
      kind: 'INSTITUTION',
      fullName: 'Otra Empresa SAC',
      ruc: '20987654321',
    });
    expect(dupRuc.status).toBe(409);
    expect(await prisma.auditLog.count({ where: { entity: 'Stakeholder' } })).toBe(0);
  }, 5_000);

  it('rejects a payload with out-of-range values', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await post(member.token).send(
      personPayload({
        fullName: 'a'.repeat(201),
        graduationYear: 1949,
      }),
    );

    expect(response.status).toBe(400);
    expect(await prisma.stakeholder.count()).toBe(0);
  }, 5_000);

  it('rejects unknown fields and a RUC on a person', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const withExtra = await post(member.token).send(personPayload({ unknownField: 'x' }));
    expect(withExtra.status).toBe(400);

    const withRuc = await post(member.token).send(personPayload({ ruc: '20123456789' }));
    expect(withRuc.status).toBe(400);
    expect(await prisma.stakeholder.count()).toBe(0);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app).post('/stakeholders').send(personPayload());
    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 and records ACCESS_DENIED without constituyente.editar', async () => {
    const teacher = await createActor(['TEACHER']);

    const response = await post(teacher.token).send(personPayload());

    expect(response.status).toBe(403);
    expect(await prisma.stakeholder.count()).toBe(0);
    const denied = await prisma.auditLog.findMany({
      where: { action: 'ACCESS_DENIED', actor: teacher.user.id },
    });
    expect(denied).toHaveLength(1);
  }, 5_000);

  it('returns 403 for a read-only role', async () => {
    const director = await createActor(['PROGRAM_DIRECTOR']);

    const response = await post(director.token).send(personPayload());

    expect(response.status).toBe(403);
    expect(await prisma.stakeholder.count()).toBe(0);
  }, 5_000);

  it('lets exactly one of N concurrent registrations of the same DNI win', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        post(member.token).send(
          personPayload({
            fullName: `Concurrente ${index + 1}`,
            dni: '77665544',
          }),
        ),
      ),
    );

    expect(responses.filter((res) => res.status === 201)).toHaveLength(1);
    expect(responses.filter((res) => res.status === 409)).toHaveLength(4);
    expect(await prisma.stakeholder.count({ where: { dni: '77665544' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entity: 'Stakeholder' } })).toBe(1);
  }, 5_000);
});
