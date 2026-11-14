import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { listCatalogVersionsResponseSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { InMemoryFileStorage } from '../../../../shared/storage/in-memory-file-storage.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import {
  createInValidationCatalogVersion,
  createRegisteredResolution,
} from '../../../../test/factories/resolutions.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

const PDF = Buffer.from('%PDF-1.4\n% resolucion firmada de prueba\n');

describe('Catalog activation on approved resolution (PostgreSQL real, HU-016, T-016-03, RF-016)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-catalog-activation-test',
  });

  const emailSender = new InMemoryEmailSender();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const fileStorage = new InMemoryFileStorage();

  const app = createApp({
    env,
    setupRoutes: (instance) => {
      setupAppRoutes(instance, {
        unitOfWork: uow,
        auditLogger: auditServices.auditLogger,
        dbProvider: uow,
        env,
        emailSender,
        fileStorage,
      });
    },
  });

  beforeEach(async () => {
    emailSender.clear();
    fileStorage.clear();
    await seedAuthorizationFast(prisma);
  });

  const createActor = (roles: string[]) =>
    createAuthenticatedActor({ prisma, jwtSecret: env.AUTH_JWT_SECRET, roles });

  const approve = (token: string, id: string) =>
    request(app)
      .post(`/resolutions/${id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/pdf')
      .send(PDF);

  async function setup() {
    const versionId = await createInValidationCatalogVersion(prisma);
    const version = await prisma.catalogVersion.findUniqueOrThrow({ where: { id: versionId } });
    const resolutionId = await createRegisteredResolution(prisma, versionId);
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    return { versionId, programId: version.programId, resolutionId, president };
  }

  const statuses = async (programId: string) =>
    (
      await prisma.catalogVersion.findMany({ where: { programId }, orderBy: { number: 'asc' } })
    ).map((row) => [row.number, row.status]);

  it('activates the version and demotes the previous one when the resolution is approved', async () => {
    const { versionId, programId, resolutionId, president } = await setup();

    const response = await approve(president.token, resolutionId);

    expect(response.status).toBe(200);
    expect(await statuses(programId)).toEqual([
      [1, 'HISTORICAL'],
      [2, 'APPROVED'],
    ]);
    const audits = await prisma.auditLog.findMany({ where: { entity: 'CatalogVersion' } });
    expect(audits).toHaveLength(2);
    expect(audits.map((audit) => audit.actor)).toEqual([president.user.id, president.user.id]);
    const activation = audits.find((audit) => audit.entityId === versionId);
    expect(activation?.before).toMatchObject({ status: 'IN_VALIDATION' });
    expect(activation?.after).toMatchObject({ status: 'APPROVED', resolutionId });
  }, 30_000);

  it('answers 403 without resolucion.aprobar and keeps both versions', async () => {
    const { programId, resolutionId } = await setup();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await approve(member.token, resolutionId);

    expect(response.status).toBe(403);
    expect(await statuses(programId)).toEqual([
      [1, 'APPROVED'],
      [2, 'IN_VALIDATION'],
    ]);
    expect(await prisma.auditLog.count({ where: { entity: 'CatalogVersion' } })).toBe(0);
  }, 30_000);

  it('rolls back the resolution approval when the activation fails', async () => {
    const { versionId, programId, resolutionId, president } = await setup();
    await prisma.catalogVersion.update({
      where: { id: versionId },
      data: { status: 'HISTORICAL' },
    });

    const response = await approve(president.token, resolutionId);

    expect(response.status).toBe(409);
    const resolution = await prisma.resolution.findUniqueOrThrow({ where: { id: resolutionId } });
    expect(resolution.status).toBe('REGISTERED');
    expect(resolution.pdfFileId).toBeNull();
    expect(fileStorage.size).toBe(0);
    expect(await statuses(programId)).toEqual([
      [1, 'APPROVED'],
      [2, 'HISTORICAL'],
    ]);
    expect(await prisma.auditLog.count({ where: { entity: 'CatalogVersion' } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entity: 'Resolution' } })).toBe(0);
  }, 30_000);

  it('approves a second resolution of an already current version', async () => {
    const { versionId, programId, resolutionId, president } = await setup();
    const second = await createRegisteredResolution(prisma, versionId, {
      type: 'GRADUATE_ATTRIBUTE',
      number: 'RD-002/2027',
    });
    expect((await approve(president.token, resolutionId)).status).toBe(200);

    const response = await approve(president.token, second);

    expect(response.status).toBe(200);
    expect(await statuses(programId)).toEqual([
      [1, 'HISTORICAL'],
      [2, 'APPROVED'],
    ]);
    expect(await prisma.auditLog.count({ where: { entity: 'CatalogVersion' } })).toBe(2);
  }, 30_000);

  it('keeps one current version in the list', async () => {
    const { resolutionId, president } = await setup();
    expect((await approve(president.token, resolutionId)).status).toBe(200);

    const response = await request(app)
      .get('/catalog-versions')
      .set('Authorization', `Bearer ${president.token}`);

    expect(response.status).toBe(200);
    const body = listCatalogVersionsResponseSchema.parse(response.body);
    expect(body.items.filter((item) => item.status === 'APPROVED')).toHaveLength(1);
    expect(body.items.map((item) => [item.number, item.status])).toEqual([
      [2, 'APPROVED'],
      [1, 'HISTORICAL'],
    ]);
  }, 30_000);
});
