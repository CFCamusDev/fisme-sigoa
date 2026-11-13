import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError, ValidationError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { ResolutionStatus } from '../domain/entities/resolution-enums.js';
import { Resolution } from '../domain/entities/resolution.js';
import {
  InvalidResolutionTransitionError,
  ResolutionNotFoundError,
  ResolutionPdfRequiredError,
} from '../domain/errors/index.js';
import type { ResolutionEventPublisher } from '../domain/ports/resolution-event-publisher.js';
import type { ResolutionPdfStorage } from '../domain/ports/resolution-pdf-storage.js';
import type { ResolutionPermissionChecker } from '../domain/ports/resolution-permission-checker.js';
import type { ResolutionRepository } from '../domain/ports/resolution-repository.js';
import { ApproveResolutionUseCase, type ApproveResolutionLogger } from './approve-resolution.js';
import { RESOLUTION_PDF_MAX_BYTES } from './resolution-pdf-rules.js';

const NOW = new Date('2026-11-14T09:00:00.000Z');
const PDF_CONTENT = Buffer.from('%PDF-1.4\n% resolucion firmada de prueba\n');

const UPLOADED = {
  provider: 'in-memory',
  publicId: 'resolutions/file-1',
  url: 'memory://resolutions/file-1',
  mimeType: 'application/pdf',
  sizeBytes: PDF_CONTENT.length,
  sha256: 'c'.repeat(64),
};

const command = {
  actorId: 'user-2',
  ip: '10.0.0.2',
  resolutionId: 'r1',
  file: { content: PDF_CONTENT, originalName: 'resolucion.pdf', mimeType: 'application/pdf' },
};

function resolution(status: ResolutionStatus = 'REGISTERED') {
  const registered = Resolution.register({
    id: 'r1',
    type: 'EDUCATIONAL_OBJECTIVE',
    number: 'RD-012/2027',
    issuedOn: new Date('2026-11-10T00:00:00.000Z'),
    catalogVersionId: 'v1',
    actorId: 'user-1',
    now: new Date('2026-11-13T12:00:00.000Z'),
  });
  if (status === 'REGISTERED') {
    return registered;
  }
  return registered.approve({
    pdf: { fileId: 'f0', ...UPLOADED },
    actorId: 'user-9',
    now: new Date('2026-11-13T18:00:00.000Z'),
  }).resolution;
}

describe('ApproveResolutionUseCase (T-048-07, RF-048, RS-020)', () => {
  let resolutionRepository: MockProxy<ResolutionRepository>;
  let pdfStorage: MockProxy<ResolutionPdfStorage>;
  let eventPublisher: MockProxy<ResolutionEventPublisher>;
  let permissionChecker: MockProxy<ResolutionPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let logger: MockProxy<ApproveResolutionLogger>;
  let useCase: ApproveResolutionUseCase;

  beforeEach(() => {
    resolutionRepository = mock<ResolutionRepository>();
    pdfStorage = mock<ResolutionPdfStorage>();
    eventPublisher = mock<ResolutionEventPublisher>();
    permissionChecker = mock<ResolutionPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    logger = mock<ApproveResolutionLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    resolutionRepository.lockForApproval.mockResolvedValue(resolution());
    resolutionRepository.approve.mockResolvedValue(true);
    pdfStorage.upload.mockResolvedValue(UPLOADED);
    useCase = new ApproveResolutionUseCase({
      resolutionRepository,
      pdfStorage,
      eventPublisher,
      permissionChecker,
      unitOfWork,
      auditLogger,
      logger,
      idGenerator: () => 'f1',
      clock: () => NOW,
    });
  });

  it('approves with the signed pdf, stores it, publishes the event and audits in one transaction', async () => {
    const result = await useCase.execute(command);

    expect(result).toEqual({
      id: 'r1',
      type: 'EDUCATIONAL_OBJECTIVE',
      number: 'RD-012/2027',
      issuedOn: '2026-11-10',
      status: 'APPROVED',
      catalogVersionId: 'v1',
      pdfFileId: 'f1',
      approvedAt: NOW.toISOString(),
      approvedBy: 'user-2',
      createdAt: '2026-11-13T12:00:00.000Z',
      updatedAt: NOW.toISOString(),
    });
    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-2',
      permission: 'resolucion.aprobar',
      scope: 'GLOBAL',
    });
    expect(pdfStorage.upload).toHaveBeenCalledWith({
      content: PDF_CONTENT,
      originalName: 'resolucion.pdf',
    });
    expect(resolutionRepository.approve).toHaveBeenCalledWith(
      'r1',
      { fileId: 'f1', ...UPLOADED },
      'user-2',
      NOW,
    );
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith({
      resolutionId: 'r1',
      type: 'EDUCATIONAL_OBJECTIVE',
      catalogVersionId: 'v1',
      approvedBy: 'user-2',
      approvedAt: NOW,
    });
    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'STATE_CHANGE',
      entity: 'Resolution',
      entityId: 'r1',
      actor: 'user-2',
      ip: '10.0.0.2',
      before: { status: 'REGISTERED' },
      after: { status: 'APPROVED', pdfSha256: UPLOADED.sha256, sizeBytes: UPLOADED.sizeBytes },
    });
    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(pdfStorage.discard).not.toHaveBeenCalled();
  });

  it('uploads the file before opening the transaction so the network does not hold the lock', async () => {
    await useCase.execute(command);

    const uploadOrder = pdfStorage.upload.mock.invocationCallOrder[0] ?? 0;
    const runOrder = unitOfWork.run.mock.invocationCallOrder[0] ?? 0;
    expect(uploadOrder).toBeGreaterThan(0);
    expect(uploadOrder).toBeLessThan(runOrder);
  });

  it('denies the action without the permission and touches nothing', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ForbiddenError);

    expect(pdfStorage.upload).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(resolutionRepository.lockForApproval).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects approval without pdf and changes nothing', async () => {
    await expect(useCase.execute({ ...command, file: null })).rejects.toBeInstanceOf(
      ResolutionPdfRequiredError,
    );

    expect(pdfStorage.upload).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects an empty pdf and uploads nothing', async () => {
    await expect(
      useCase.execute({ ...command, file: { ...command.file, content: Buffer.alloc(0) } }),
    ).rejects.toBeInstanceOf(ResolutionPdfRequiredError);

    expect(pdfStorage.upload).not.toHaveBeenCalled();
  });

  it('rejects a file that is not a pdf', async () => {
    await expect(
      useCase.execute({ ...command, file: { ...command.file, mimeType: 'image/png' } }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(pdfStorage.upload).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects a file declared as pdf without the pdf signature', async () => {
    await expect(
      useCase.execute({
        ...command,
        file: { ...command.file, content: Buffer.from('<html>no soy un pdf</html>') },
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(pdfStorage.upload).not.toHaveBeenCalled();
  });

  it('rejects a pdf larger than the limit and accepts one of exactly the limit', async () => {
    const header = Buffer.from('%PDF-1.4\n');
    const tooLarge = Buffer.concat([
      header,
      Buffer.alloc(RESOLUTION_PDF_MAX_BYTES + 1 - header.length),
    ]);
    const atLimit = Buffer.concat([header, Buffer.alloc(RESOLUTION_PDF_MAX_BYTES - header.length)]);

    await expect(
      useCase.execute({ ...command, file: { ...command.file, content: tooLarge } }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(pdfStorage.upload).not.toHaveBeenCalled();

    await expect(
      useCase.execute({ ...command, file: { ...command.file, content: atLimit } }),
    ).resolves.toMatchObject({ status: 'APPROVED' });
  });

  it('rejects a missing resolution and discards the uploaded file', async () => {
    resolutionRepository.lockForApproval.mockResolvedValue(null);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ResolutionNotFoundError);

    expect(pdfStorage.discard).toHaveBeenCalledWith(UPLOADED.publicId);
    expect(resolutionRepository.approve).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects an already approved resolution without changes, event or audit and discards the file', async () => {
    resolutionRepository.lockForApproval.mockResolvedValue(resolution('APPROVED'));

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(InvalidResolutionTransitionError);

    expect(resolutionRepository.approve).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
    expect(pdfStorage.discard).toHaveBeenCalledWith(UPLOADED.publicId);
  });

  it('rejects when the conditional update affects no row and discards the file', async () => {
    resolutionRepository.approve.mockResolvedValue(false);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(InvalidResolutionTransitionError);

    expect(eventPublisher.publish).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
    expect(pdfStorage.discard).toHaveBeenCalledWith(UPLOADED.publicId);
  });

  it('propagates a failing subscriber, audits nothing and discards the uploaded file', async () => {
    eventPublisher.publish.mockRejectedValue(new Error('subscriber failed'));

    await expect(useCase.execute(command)).rejects.toThrow('subscriber failed');

    expect(auditLogger.log).not.toHaveBeenCalled();
    expect(pdfStorage.discard).toHaveBeenCalledTimes(1);
    expect(pdfStorage.discard).toHaveBeenCalledWith(UPLOADED.publicId);
  });

  it('keeps the original error and logs when discarding the file fails', async () => {
    eventPublisher.publish.mockRejectedValue(new Error('subscriber failed'));
    pdfStorage.discard.mockRejectedValue(new Error('cloud unavailable'));

    await expect(useCase.execute(command)).rejects.toThrow('subscriber failed');

    expect(logger.warn).toHaveBeenCalledWith(
      { publicId: UPLOADED.publicId, error: 'cloud unavailable' },
      expect.any(String),
    );
  });

  it('does not touch the database when the upload itself fails', async () => {
    pdfStorage.upload.mockRejectedValue(new Error('upload failed'));

    await expect(useCase.execute(command)).rejects.toThrow('upload failed');

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(pdfStorage.discard).not.toHaveBeenCalled();
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
  });
});
