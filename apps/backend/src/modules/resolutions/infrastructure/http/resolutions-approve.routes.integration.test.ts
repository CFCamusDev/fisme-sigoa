import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { resolutionDtoSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { computeSha256 } from '../../../../shared/storage/file-hash.js';
import { InMemoryFileStorage } from '../../../../shared/storage/in-memory-file-storage.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import {
  createInValidationCatalogVersion,
  createRegisteredResolution,
} from '../../../../test/factories/resolutions.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import type { ResolutionApproved } from '../../domain/entities/resolution-approved.js';

const PDF = Buffer.from('%PDF-1.4\n% resolucion firmada de prueba\n');
const PDF_LIMIT = 10 * 1024 * 1024;

describe('POST /resolutions/:id/approve (PostgreSQL real, HU-048, T-048-21, RF-048, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-resolutions-approve-test',
  });

  const emailSender = new InMemoryEmailSender();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const fileStorage = new InMemoryFileStorage();
  const subscriber = vi.fn<(event: ResolutionApproved) => Promise<void>>(async () => undefined);

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
        resolutionApprovedSubscribers: [(event) => subscriber(event)],
      });
    },
  });

  beforeEach(async () => {
    emailSender.clear();
    fileStorage.clear();
    subscriber.mockReset();
    subscriber.mockResolvedValue(undefined);
    await seedAuthorizationFast(prisma);
  });

  const createActor = (roles: string[]) =>
    createAuthenticatedActor({ prisma, jwtSecret: env.AUTH_JWT_SECRET, roles });

  const approve = (token: string, id: string) =>
    request(app).post(`/resolutions/${id}/approve`).set('Authorization', `Bearer ${token}`);

  const approveWithPdf = (token: string, id: string, content: Buffer = PDF) =>
    approve(token, id).set('Content-Type', 'application/pdf').send(content);

  async function setup() {
    const versionId = await createInValidationCatalogVersion(prisma);
    const resolutionId = await createRegisteredResolution(prisma, versionId);
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    return { versionId, resolutionId, president };
  }

  const audits = () => prisma.auditLog.count({ where: { entity: 'Resolution' } });
  const storedFiles = () => prisma.storedFile.count();

  async function expectUntouched(resolutionId: string) {
    const row = await prisma.resolution.findUniqueOrThrow({ where: { id: resolutionId } });
    expect(row.status).toBe('REGISTERED');
    expect(row.pdfFileId).toBeNull();
    expect(await storedFiles()).toBe(0);
    expect(await audits()).toBe(0);
    expect(fileStorage.size).toBe(0);
    expect(subscriber).not.toHaveBeenCalled();
  }

  describe('Success (200)', () => {
    it('approves with the signed pdf, stores it with its hash, publishes the event and audits (CA2)', async () => {
      const { resolutionId, versionId, president } = await setup();

      const response = await approveWithPdf(president.token, resolutionId);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const dto = resolutionDtoSchema.parse(response.body);
      expect(dto).toMatchObject({
        id: resolutionId,
        status: 'APPROVED',
        approvedBy: president.user.id,
      });
      expect(dto.pdfFileId).not.toBeNull();
      expect(dto.approvedAt).not.toBeNull();
      const stored = await prisma.storedFile.findUniqueOrThrow({
        where: { id: dto.pdfFileId ?? '' },
      });
      expect(stored.sha256).toBe(computeSha256(PDF));
      expect(stored.sizeBytes).toBe(PDF.length);
      expect(stored.mimeType).toBe('application/pdf');
      expect(fileStorage.hasFile(stored.publicId)).toBe(true);
      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber.mock.calls[0]?.[0]).toMatchObject({
        resolutionId,
        type: 'EDUCATIONAL_OBJECTIVE',
        catalogVersionId: versionId,
        approvedBy: president.user.id,
      });
      const events = await prisma.auditLog.findMany({ where: { entity: 'Resolution' } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'STATE_CHANGE',
        entityId: resolutionId,
        actor: president.user.id,
      });
      expect(events[0]?.before).toMatchObject({ status: 'REGISTERED' });
      expect(events[0]?.after).toMatchObject({
        status: 'APPROVED',
        pdfSha256: computeSha256(PDF),
      });
    });

    it('accepts a Content-Type with parameters', async () => {
      const { resolutionId, president } = await setup();

      const response = await approve(president.token, resolutionId)
        .set('Content-Type', 'application/pdf; charset=binary')
        .send(PDF);

      expect(response.status).toBe(200);
    });
  });

  describe('Validation (400)', () => {
    it('requires the pdf when there is no body (CA3)', async () => {
      const { resolutionId, president } = await setup();

      const response = await approve(president.token, resolutionId);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/PDF firmado/);
      await expectUntouched(resolutionId);
    });

    it('requires the pdf when the body is JSON (CA3)', async () => {
      const { resolutionId, president } = await setup();

      const response = await approve(president.token, resolutionId).send({ file: 'x' });

      expect(response.status).toBe(400);
      await expectUntouched(resolutionId);
    });

    it('rejects a body that is not a pdf even if declared as pdf', async () => {
      const { resolutionId, president } = await setup();

      const response = await approveWithPdf(
        president.token,
        resolutionId,
        Buffer.from('<html>hola</html>'),
      );

      expect(response.status).toBe(400);
      await expectUntouched(resolutionId);
    });

    it('rejects an empty pdf', async () => {
      const { resolutionId, president } = await setup();

      const response = await approveWithPdf(president.token, resolutionId, Buffer.alloc(0));

      expect(response.status).toBe(400);
      await expectUntouched(resolutionId);
    });

    it('rejects a pdf of 10 MiB plus one byte with 400 and stores nothing', async () => {
      const { resolutionId, president } = await setup();
      const tooLarge = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(PDF_LIMIT)]);

      const response = await approveWithPdf(president.token, resolutionId, tooLarge);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/tamaño máximo/);
      await expectUntouched(resolutionId);
    }, 20_000);

    it('rejects an id of 65 characters', async () => {
      const { president } = await setup();

      const response = await approveWithPdf(president.token, 'r'.repeat(65));

      expect(response.status).toBe(400);
      expect(fileStorage.size).toBe(0);
    });
  });

  describe('Authentication and authorization', () => {
    it('answers 401 without a token', async () => {
      const { resolutionId } = await setup();

      const response = await request(app)
        .post(`/resolutions/${resolutionId}/approve`)
        .set('Content-Type', 'application/pdf')
        .send(PDF);

      expect(response.status).toBe(401);
    });

    it.each(['COMMITTEE_MEMBER', 'TEACHER'])(
      'answers 403 for the %s role without uploading nor persisting anything',
      async (role) => {
        const { resolutionId } = await setup();
        const actor = await createActor([role]);

        const response = await approveWithPdf(actor.token, resolutionId);

        expect(response.status).toBe(403);
        await expectUntouched(resolutionId);
      },
    );
  });

  describe('Not found (404) and conflicts (409)', () => {
    it('answers 404 for a missing resolution and discards the uploaded file', async () => {
      const { president } = await setup();

      const response = await approveWithPdf(president.token, 'missing-resolution');

      expect(response.status).toBe(404);
      expect(fileStorage.size).toBe(0);
      expect(await storedFiles()).toBe(0);
      expect(await audits()).toBe(0);
    });

    it('answers 409 for an already approved resolution without changes, event, audit or new file', async () => {
      const { resolutionId, president } = await setup();
      const first = await approveWithPdf(president.token, resolutionId);
      expect(first.status).toBe(200);
      const other = await createActor(['COMMITTEE_PRESIDENT']);

      const second = await approveWithPdf(
        other.token,
        resolutionId,
        Buffer.from('%PDF-1.7\n% otro\n'),
      );

      expect(second.status).toBe(409);
      const row = await prisma.resolution.findUniqueOrThrow({ where: { id: resolutionId } });
      expect(row.approvedBy).toBe(president.user.id);
      expect(row.pdfFileId).toBe(first.body.pdfFileId);
      expect(await storedFiles()).toBe(1);
      expect(await audits()).toBe(1);
      expect(fileStorage.size).toBe(1);
      expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('rolls back and discards the file when a subscriber fails', async () => {
      const { resolutionId, president } = await setup();
      subscriber.mockRejectedValue(new Error('subscriber failed'));

      const response = await approveWithPdf(president.token, resolutionId);

      expect(response.status).toBe(500);
      const row = await prisma.resolution.findUniqueOrThrow({ where: { id: resolutionId } });
      expect(row.status).toBe('REGISTERED');
      expect(row.pdfFileId).toBeNull();
      expect(await storedFiles()).toBe(0);
      expect(await audits()).toBe(0);
      expect(fileStorage.size).toBe(0);
    });
  });

  describe('Concurrency', () => {
    it('lets exactly one of N simultaneous requests approve and answers 409 to the rest', async () => {
      const { resolutionId, president } = await setup();

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => approveWithPdf(president.token, resolutionId)),
      );

      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 409, 409, 409, 409,
      ]);
      const row = await prisma.resolution.findUniqueOrThrow({ where: { id: resolutionId } });
      expect(row.status).toBe('APPROVED');
      expect(await storedFiles()).toBe(1);
      expect(await audits()).toBe(1);
      expect(fileStorage.size).toBe(1);
      expect(subscriber).toHaveBeenCalledTimes(1);
    }, 20_000);
  });
});
