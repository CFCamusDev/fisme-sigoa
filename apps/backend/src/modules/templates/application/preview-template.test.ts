import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { PdfGenerator } from '../../../shared/pdf/pdf-generator.js';
import { Template } from '../domain/entities/template.js';
import {
  InvalidTemplateDataError,
  TemplateNotFoundError,
  TemplatePreviewInProgressError,
} from '../domain/errors/index.js';
import type { TemplatePermissionChecker } from '../domain/ports/template-permission-checker.js';
import type { TemplateReader } from '../domain/ports/template-reader.js';
import { PREVIEW_FOOTER_TEMPLATE, PreviewTemplateUseCase } from './preview-template.js';

const template = Template.create({
  id: 't1',
  code: 'FO-01',
  name: 'Anexo 1',
  type: 'ANNEX',
  variables: [{ key: 'program.name', label: 'Programa' }],
});

describe('PreviewTemplateUseCase (T-019-09, RF-019)', () => {
  let templateReader: MockProxy<TemplateReader>;
  let permissionChecker: MockProxy<TemplatePermissionChecker>;
  let pdfGenerator: MockProxy<PdfGenerator>;
  let useCase: PreviewTemplateUseCase;

  beforeEach(() => {
    templateReader = mock<TemplateReader>();
    permissionChecker = mock<TemplatePermissionChecker>();
    pdfGenerator = mock<PdfGenerator>();

    templateReader.findById.mockResolvedValue(template);
    permissionChecker.assertAllowed.mockResolvedValue(undefined);
    pdfGenerator.render.mockResolvedValue(Buffer.from('%PDF-1.4\nSample'));

    useCase = new PreviewTemplateUseCase({
      templateReader,
      permissionChecker,
      pdfGenerator,
    });
  });

  it('renders the template with sample data and returns the pdf', async () => {
    const result = await useCase.execute({
      actorId: 'user-1',
      templateId: 't1',
      content: '<p>{{program.name}}</p>',
    });

    expect(result.warnings).toEqual([]);
    expect(Buffer.from(result.pdfBase64, 'base64').toString('utf8')).toBe('%PDF-1.4\nSample');
    expect(pdfGenerator.render).toHaveBeenCalledWith(
      expect.objectContaining({
        html: '<p>Programa (ejemplo)</p>',
      }),
    );
  });

  it('warns about unrecognized variables instead of failing', async () => {
    const result = await useCase.execute({
      actorId: 'user-1',
      templateId: 't1',
      content: '<p>{{program.name}} {{unknown.key}} {{other.missing}}</p>',
    });

    expect(result.warnings).toEqual([{ variable: 'unknown.key' }, { variable: 'other.missing' }]);
    expect(pdfGenerator.render).toHaveBeenCalledWith(
      expect.objectContaining({
        html: '<p>Programa (ejemplo) {{unknown.key}} {{other.missing}}</p>',
      }),
    );
  });

  it('rejects unsafe html with a validation error', async () => {
    await expect(
      useCase.execute({
        actorId: 'user-1',
        templateId: 't1',
        content: '<p>hola</p><script>alert(1)</script>',
      }),
    ).rejects.toThrow(InvalidTemplateDataError);

    expect(pdfGenerator.render).not.toHaveBeenCalled();
  });

  it('denies the preview without the edit permission', async () => {
    permissionChecker.assertAllowed.mockRejectedValueOnce(new ForbiddenError('Sin permiso'));

    await expect(
      useCase.execute({
        actorId: 'user-1',
        templateId: 't1',
        content: '<p>{{program.name}}</p>',
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'plantilla.editar',
      scope: 'GLOBAL',
    });
    expect(templateReader.findById).not.toHaveBeenCalled();
  });

  it('fails with not found for an unknown template', async () => {
    templateReader.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        templateId: 'missing',
        content: '<p>texto</p>',
      }),
    ).rejects.toThrow(TemplateNotFoundError);
  });

  it('adds the sample footer and css page size options', async () => {
    await useCase.execute({
      actorId: 'user-1',
      templateId: 't1',
      content: '<p>{{program.name}}</p>',
    });

    expect(pdfGenerator.render).toHaveBeenCalledWith({
      html: '<p>Programa (ejemplo)</p>',
      options: {
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: PREVIEW_FOOTER_TEMPLATE,
      },
    });
  });

  it('stores and renders the sanitized content', async () => {
    await useCase.execute({
      actorId: 'user-1',
      templateId: 't1',
      content: '<!-- comentario --><p>{{program.name}}</p>',
    });

    expect(pdfGenerator.render).toHaveBeenCalledWith(
      expect.objectContaining({
        html: '<p>Programa (ejemplo)</p>',
      }),
    );
  });

  it('rejects a second preview from the same actor while one is in flight', async () => {
    let releaseFirst!: () => void;
    pdfGenerator.render.mockImplementationOnce(
      () =>
        new Promise<Buffer>((resolve) => {
          releaseFirst = () => resolve(Buffer.from('%PDF-1.4\nFirst'));
        }),
    );

    const first = useCase.execute({
      actorId: 'user-1',
      templateId: 't1',
      content: '<p>{{program.name}}</p>',
    });

    await vi.waitFor(() => {
      expect(pdfGenerator.render).toHaveBeenCalledTimes(1);
    });

    await expect(
      useCase.execute({
        actorId: 'user-1',
        templateId: 't1',
        content: '<p>{{program.name}}</p>',
      }),
    ).rejects.toThrow(TemplatePreviewInProgressError);

    releaseFirst();
    await expect(first).resolves.toMatchObject({ warnings: [] });
  });

  it('allows previews from different actors at the same time', async () => {
    let releaseFirst!: () => void;
    pdfGenerator.render
      .mockImplementationOnce(
        () =>
          new Promise<Buffer>((resolve) => {
            releaseFirst = () => resolve(Buffer.from('%PDF-1.4\nOne'));
          }),
      )
      .mockResolvedValueOnce(Buffer.from('%PDF-1.4\nTwo'));

    const first = useCase.execute({
      actorId: 'user-1',
      templateId: 't1',
      content: '<p>{{program.name}}</p>',
    });

    await vi.waitFor(() => {
      expect(pdfGenerator.render).toHaveBeenCalledTimes(1);
    });

    const second = await useCase.execute({
      actorId: 'user-2',
      templateId: 't1',
      content: '<p>{{program.name}}</p>',
    });
    expect(second.warnings).toEqual([]);

    releaseFirst();
    const firstResult = await first;
    expect(firstResult.warnings).toEqual([]);
  });

  it('releases the actor slot when rendering fails', async () => {
    pdfGenerator.render
      .mockRejectedValueOnce(new Error('Chromium crashed'))
      .mockResolvedValueOnce(Buffer.from('%PDF-1.4\nRecovered'));

    await expect(
      useCase.execute({
        actorId: 'user-1',
        templateId: 't1',
        content: '<p>{{program.name}}</p>',
      }),
    ).rejects.toThrow('Chromium crashed');

    const next = await useCase.execute({
      actorId: 'user-1',
      templateId: 't1',
      content: '<p>{{program.name}}</p>',
    });
    expect(Buffer.from(next.pdfBase64, 'base64').toString('utf8')).toBe('%PDF-1.4\nRecovered');
  });

  it('does not persist or audit anything', async () => {
    await useCase.execute({
      actorId: 'user-1',
      templateId: 't1',
      content: '<p>{{program.name}}</p>',
    });

    expect(templateReader.findById).toHaveBeenCalledTimes(1);
    expect(templateReader.findByCode).not.toHaveBeenCalled();
    expect(templateReader.list).not.toHaveBeenCalled();
  });
});
