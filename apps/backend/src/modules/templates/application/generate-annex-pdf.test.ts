import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { PdfGenerator } from '../../../shared/pdf/pdf-generator.js';
import { EMPTY_PDF_HEADER_TEMPLATE } from '../../../shared/pdf/pdf-options.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Template } from '../domain/entities/template.js';
import { TemplateVersion } from '../domain/entities/template-version.js';
import {
  AnnexDownloadInProgressError,
  TemplateNotFoundError,
  TemplateVersionNotFoundError,
} from '../domain/errors/index.js';
import type { AnnexDataProvider } from '../domain/ports/annex-data-provider.js';
import type { TemplatePermissionChecker } from '../domain/ports/template-permission-checker.js';
import type { TemplateReader } from '../domain/ports/template-reader.js';
import type { TemplateVersionReader } from '../domain/ports/template-version-reader.js';
import {
  GenerateAnnexPdfUseCase,
  MAX_ANNEX_PDF_BYTES,
  formatAnnexFileName,
} from './generate-annex-pdf.js';

const FIXED_DATE = new Date('2026-11-20T15:30:00.000Z'); // 10:30 en America/Lima (UTC-5)

function createAnnexTemplate(type: 'ANNEX' | 'MINUTES' = 'ANNEX'): Template {
  return Template.create({
    id: 'tpl-fo-01',
    code: 'FO-01',
    name: 'Anexo 1. Cronograma',
    type,
    variables: [
      { key: 'logo.url', label: 'Escudo' },
      { key: 'schedule.period', label: 'Periodo' },
      { key: 'activities.name', label: 'Actividad' },
    ],
  });
}

function createPublishedVersion(number = 2, content?: string): TemplateVersion {
  return TemplateVersion.create({
    id: `ver-${number}`,
    templateId: 'tpl-fo-01',
    number,
    status: 'PUBLISHED',
    content:
      content ??
      '<header><img src="{{logo.url}}" /></header><p>{{schedule.period}}</p><table><tr data-repeat="activities"><td>{{activities.name}}</td></tr></table>',
    updatedBy: 'admin-1',
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    publishedBy: 'admin-1',
    publishedAt: FIXED_DATE,
  });
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('GenerateAnnexPdfUseCase (T-070-09, RF-070)', () => {
  let templateReader: MockProxy<TemplateReader>;
  let versionReader: MockProxy<TemplateVersionReader>;
  let permissionChecker: MockProxy<TemplatePermissionChecker>;
  let pdfGenerator: MockProxy<PdfGenerator>;
  let unitOfWork: UnitOfWork;
  let auditLogger: MockProxy<AuditLogger>;
  let provider: MockProxy<AnnexDataProvider>;
  let useCase: GenerateAnnexPdfUseCase;
  const samplePdf = Buffer.from('%PDF-1.4\nOfficial annex');

  beforeEach(() => {
    templateReader = mock<TemplateReader>();
    versionReader = mock<TemplateVersionReader>();
    permissionChecker = mock<TemplatePermissionChecker>();
    pdfGenerator = mock<PdfGenerator>();
    auditLogger = mock<AuditLogger>();
    provider = mock<AnnexDataProvider>();
    unitOfWork = {
      run: vi.fn(async (fn) => fn(undefined as never)),
    };

    permissionChecker.assertAllowed.mockResolvedValue(undefined);
    templateReader.findByCode.mockResolvedValue(createAnnexTemplate());
    versionReader.findPublished.mockResolvedValue(createPublishedVersion(2));
    provider.supports.mockReturnValue(true);
    provider.provide.mockResolvedValue({
      scalars: { 'logo.url': 'data:image/png;base64,AAAA' },
    });
    pdfGenerator.render.mockResolvedValue(samplePdf);
    auditLogger.log.mockResolvedValue(undefined);

    useCase = new GenerateAnnexPdfUseCase({
      templateReader,
      versionReader,
      permissionChecker,
      pdfGenerator,
      unitOfWork,
      auditLogger,
      dataProviders: [provider],
      clock: () => FIXED_DATE,
    });
  });

  it('renders the published version of the annex and returns the pdf', async () => {
    const result = await useCase.execute({
      actorId: 'user-1',
      ip: '127.0.0.1',
      annexCode: 'FO-01',
    });

    expect(result).toEqual({
      pdf: samplePdf,
      fileName: 'fo-01-v2.pdf',
      templateCode: 'FO-01',
      versionNumber: 2,
    });

    const renderedHtml = pdfGenerator.render.mock.calls[0]?.[0].html ?? '';
    expect(renderedHtml).toContain('data:image/png;base64,AAAA');
    expect(renderedHtml).toContain('<p>(sin periodo definido)</p>');
    expect(renderedHtml).not.toContain('{{');
  });

  it('audits the official download with the template version and the pdf hash', async () => {
    await useCase.execute({
      actorId: 'user-1',
      ip: '10.0.0.5',
      annexCode: 'FO-01',
    });

    const expectedSha256 = createHash('sha256').update(samplePdf).digest('hex');

    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'DOWNLOAD',
      entity: 'TemplateVersion',
      entityId: 'ver-2',
      actor: 'user-1',
      ip: '10.0.0.5',
      after: {
        templateId: 'tpl-fo-01',
        templateCode: 'FO-01',
        versionId: 'ver-2',
        versionNumber: 2,
        pdfSha256: expectedSha256,
        pdfBytes: samplePdf.byteLength,
        generatedAt: FIXED_DATE.toISOString(),
      },
    });
  });

  it('denies the download without the permission', async () => {
    permissionChecker.assertAllowed.mockRejectedValueOnce(new ForbiddenError('Sin permiso'));

    await expect(
      useCase.execute({
        actorId: 'user-1',
        annexCode: 'FO-01',
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'documento.descargar',
      scope: 'GLOBAL',
    });
    expect(pdfGenerator.render).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('fails with not found for an unknown or non-annex template', async () => {
    templateReader.findByCode.mockResolvedValueOnce(null);
    await expect(useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' })).rejects.toThrow(
      TemplateNotFoundError,
    );

    templateReader.findByCode.mockResolvedValueOnce(createAnnexTemplate('MINUTES'));
    await expect(useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' })).rejects.toThrow(
      TemplateNotFoundError,
    );
  });

  it('fails when the annex has no published version', async () => {
    versionReader.findPublished.mockResolvedValueOnce(null);

    await expect(useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' })).rejects.toThrow(
      TemplateVersionNotFoundError,
    );
    expect(pdfGenerator.render).not.toHaveBeenCalled();
  });

  it('does not deliver the pdf when the audit fails', async () => {
    auditLogger.log.mockRejectedValueOnce(new Error('DB write failed'));

    await expect(useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' })).rejects.toThrow(
      'DB write failed',
    );
  });

  it('rejects pdfs exceeding the maximum size before auditing', async () => {
    pdfGenerator.render.mockResolvedValueOnce(Buffer.alloc(MAX_ANNEX_PDF_BYTES + 1));

    await expect(useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' })).rejects.toThrow(
      'tamaño máximo',
    );
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('uses the published version at the moment of the download', async () => {
    versionReader.findPublished
      .mockResolvedValueOnce(createPublishedVersion(2))
      .mockResolvedValueOnce(createPublishedVersion(3));

    const first = await useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' });
    const second = await useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' });

    expect(first.versionNumber).toBe(2);
    expect(first.fileName).toBe('fo-01-v2.pdf');
    expect(second.versionNumber).toBe(3);
    expect(second.fileName).toBe('fo-01-v3.pdf');
  });

  it('adds the version footer and css page size options', async () => {
    await useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' });

    const call = pdfGenerator.render.mock.calls[0]?.[0];
    expect(call?.options).toMatchObject({
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: EMPTY_PDF_HEADER_TEMPLATE,
    });
    expect(call?.options?.footerTemplate).toContain(
      'FO-01 · Versión 2 · Generado el 20/11/2026 10:30',
    );
    expect(call?.options?.footerTemplate).toContain('pageNumber');
    expect(call?.options?.footerTemplate).toContain('totalPages');
  });

  it('renders FO-01 without dashes when there is no execution data', async () => {
    await useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' });

    const call = pdfGenerator.render.mock.calls[0]?.[0];
    expect(call?.html).toContain('<p>(sin periodo definido)</p>');
    expect(call?.html).not.toContain('—');
  });

  it('rejects a second download from the same actor while one is in flight', async () => {
    const deferred = createDeferred<Buffer>();
    pdfGenerator.render.mockReturnValueOnce(deferred.promise);

    const firstPromise = useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' });
    await vi.waitFor(() => {
      expect(pdfGenerator.render).toHaveBeenCalledTimes(1);
    });

    await expect(useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' })).rejects.toThrow(
      AnnexDownloadInProgressError,
    );

    deferred.resolve(samplePdf);
    const firstResult = await firstPromise;
    expect(firstResult.pdf).toEqual(samplePdf);
  });

  it('allows downloads from different actors at the same time', async () => {
    const firstDeferred = createDeferred<Buffer>();
    const secondDeferred = createDeferred<Buffer>();
    pdfGenerator.render
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise);

    const p1 = useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' });
    const p2 = useCase.execute({ actorId: 'user-2', annexCode: 'FO-01' });

    await vi.waitFor(() => {
      expect(pdfGenerator.render).toHaveBeenCalledTimes(2);
    });

    firstDeferred.resolve(samplePdf);
    secondDeferred.resolve(samplePdf);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.templateCode).toBe('FO-01');
    expect(r2.templateCode).toBe('FO-01');
  });

  it('releases the actor slot when rendering or auditing fails', async () => {
    pdfGenerator.render.mockRejectedValueOnce(new Error('Chromium crashed'));
    await expect(useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' })).rejects.toThrow(
      'Chromium crashed',
    );

    auditLogger.log.mockRejectedValueOnce(new Error('Audit error'));
    await expect(useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' })).rejects.toThrow(
      'Audit error',
    );

    const recovery = await useCase.execute({ actorId: 'user-1', annexCode: 'FO-01' });
    expect(recovery.pdf).toEqual(samplePdf);
  });

  it('audits the download on the subject entity when a subject is given', async () => {
    const result = await useCase.execute({
      actorId: 'user-1',
      ip: '10.0.0.8',
      annexCode: 'FO-01',
      fileLabel: '2026',
      data: {
        scalars: { 'schedule.period': '2026-I' },
        collections: { activities: [{ name: 'Taller 1' }] },
      },
      subject: {
        entity: 'StakeholderList',
        entityId: 'list-99',
        metadata: { year: 2026, memberCount: 1 },
      },
    });

    expect(result.fileName).toBe('fo-01-2026-v2.pdf');

    const renderedHtml = pdfGenerator.render.mock.calls[0]?.[0].html ?? '';
    expect(renderedHtml).toContain('data:image/png;base64,AAAA');
    expect(renderedHtml).toContain('<p>2026-I</p>');
    expect(renderedHtml).toContain('<td>Taller 1</td>');

    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'DOWNLOAD',
      entity: 'StakeholderList',
      entityId: 'list-99',
      actor: 'user-1',
      ip: '10.0.0.8',
      after: {
        templateId: 'tpl-fo-01',
        templateCode: 'FO-01',
        versionId: 'ver-2',
        versionNumber: 2,
        pdfSha256: createHash('sha256').update(samplePdf).digest('hex'),
        pdfBytes: samplePdf.byteLength,
        generatedAt: FIXED_DATE.toISOString(),
        year: 2026,
        memberCount: 1,
      },
    });
  });

  it('formats annex file names with optional sanitized label', () => {
    expect(formatAnnexFileName('FO-03', 1)).toBe('fo-03-v1.pdf');
    expect(formatAnnexFileName('FO-03', 1, '2026')).toBe('fo-03-2026-v1.pdf');
    expect(formatAnnexFileName('FO-03', 2, '  /2026/  ')).toBe('fo-03-2026-v2.pdf');
  });
});
