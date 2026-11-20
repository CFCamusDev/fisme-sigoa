import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { PdfGenerator } from '../../../shared/pdf/pdf-generator.js';
import { computeSha256 } from '../../../shared/storage/file-hash.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { OfficialDownloadRecord } from '../domain/entities/official-download-record.js';
import {
  AnnexDownloadInProgressError,
  TemplateNotFoundError,
  TemplateVersionNotFoundError,
} from '../domain/errors/index.js';
import { buildOfficialRenderData } from '../domain/policies/official-render-data.js';
import { validateTemplateStructure } from '../domain/policies/template-content-policy.js';
import {
  renderTemplateHtml,
  type TemplateRenderData,
} from '../domain/policies/template-renderer.js';
import type { AnnexDataProvider } from '../domain/ports/annex-data-provider.js';
import type { TemplatePermissionChecker } from '../domain/ports/template-permission-checker.js';
import type { TemplateReader } from '../domain/ports/template-reader.js';
import type { TemplateVersionReader } from '../domain/ports/template-version-reader.js';
import { buildAnnexPdfFooter } from './annex-pdf-footer.js';
import type {
  GenerateAnnexPdfCommand,
  GenerateAnnexPdfResult,
} from './generate-annex-pdf.types.js';

export const MAX_ANNEX_PDF_BYTES = 20 * 1024 * 1024;

export interface GenerateAnnexPdfDependencies {
  readonly templateReader: TemplateReader;
  readonly versionReader: TemplateVersionReader;
  readonly permissionChecker: TemplatePermissionChecker;
  readonly pdfGenerator: PdfGenerator;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly dataProviders?: readonly AnnexDataProvider[];
  readonly clock?: () => Date;
}

function sanitizeFileSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-.]/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatAnnexFileName(
  templateCode: string,
  versionNumber: number,
  fileLabel?: string,
): string {
  const sanitizedCode = sanitizeFileSegment(templateCode);
  const baseCode = sanitizedCode.length > 0 ? sanitizedCode : 'annex';
  const sanitizedLabel = fileLabel ? sanitizeFileSegment(fileLabel) : '';
  return sanitizedLabel.length > 0
    ? `${baseCode}-${sanitizedLabel}-v${versionNumber}.pdf`
    : `${baseCode}-v${versionNumber}.pdf`;
}

function mergeRenderData(
  provided: Partial<TemplateRenderData>,
  override?: Partial<TemplateRenderData>,
): Partial<TemplateRenderData> {
  if (!override) {
    return provided;
  }
  return {
    scalars: {
      ...(provided.scalars ?? {}),
      ...(override.scalars ?? {}),
    },
    collections: {
      ...(provided.collections ?? {}),
      ...(override.collections ?? {}),
    },
  };
}

/**
 * Genera el PDF oficial de uno de los 11 anexos desde su versión Publicada (HU-070, RF-070).
 * Renderiza fuera de la transacción y audita `DOWNLOAD` antes de entregar el binario (D5).
 */
export class GenerateAnnexPdfUseCase {
  private readonly inFlightActors = new Set<string>();
  private readonly dataProviders: readonly AnnexDataProvider[];
  private readonly clock: () => Date;

  constructor(private readonly deps: GenerateAnnexPdfDependencies) {
    this.dataProviders = deps.dataProviders ?? [];
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: GenerateAnnexPdfCommand): Promise<GenerateAnnexPdfResult> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'documento.descargar',
      scope: 'GLOBAL',
    });

    if (this.inFlightActors.has(command.actorId)) {
      throw new AnnexDownloadInProgressError();
    }

    this.inFlightActors.add(command.actorId);
    try {
      const template = await this.deps.templateReader.findByCode(command.annexCode);
      if (!template || template.type !== 'ANNEX') {
        throw new TemplateNotFoundError();
      }

      const version = await this.deps.versionReader.findPublished(template.id);
      if (!version) {
        throw new TemplateVersionNotFoundError('El anexo no tiene una versión publicada.');
      }

      validateTemplateStructure(version.content);

      const generatedAt = this.clock();
      const provided = await this.collectProviderData(template.code, generatedAt);
      const merged = mergeRenderData(provided, command.data);
      const renderData = buildOfficialRenderData(template.variables, merged, version.content);
      const html = renderTemplateHtml(version.content, renderData);
      const footerTemplate = buildAnnexPdfFooter({
        templateCode: template.code,
        versionNumber: version.number,
        generatedAt,
      });

      const pdf = await this.deps.pdfGenerator.render({
        html,
        options: {
          format: 'A4',
          preferCSSPageSize: true,
          printBackground: true,
          displayHeaderFooter: true,
          footerTemplate,
        },
      });

      if (pdf.byteLength > MAX_ANNEX_PDF_BYTES) {
        throw new AppError(
          'El PDF generado excede el tamaño máximo permitido.',
          'INTERNAL_ERROR',
          500,
        );
      }

      const record = OfficialDownloadRecord.create({
        templateId: template.id,
        templateCode: template.code,
        versionId: version.id,
        versionNumber: version.number,
        pdfSha256: computeSha256(pdf),
        pdfBytes: pdf.byteLength,
        generatedAt,
      });

      const auditEntity = command.subject?.entity ?? 'TemplateVersion';
      const auditEntityId = command.subject?.entityId ?? version.id;
      const auditAfter = command.subject?.metadata
        ? { ...record.toAuditPayload(), ...command.subject.metadata }
        : record.toAuditPayload();

      await this.deps.unitOfWork.run(async () => {
        await this.deps.auditLogger.log({
          action: 'DOWNLOAD',
          entity: auditEntity,
          entityId: auditEntityId,
          after: auditAfter,
          actor: command.actorId,
          ip: command.ip,
        });
      });

      return {
        pdf,
        fileName: formatAnnexFileName(template.code, version.number, command.fileLabel),
        templateCode: template.code,
        versionNumber: version.number,
      };
    } finally {
      this.inFlightActors.delete(command.actorId);
    }
  }

  private async collectProviderData(
    annexCode: string,
    generatedAt: Date,
  ): Promise<Partial<TemplateRenderData>> {
    const scalars: Record<string, string> = {};
    const collections: Record<string, readonly Readonly<Record<string, string>>[]> = {};

    for (const provider of this.dataProviders) {
      if (!provider.supports(annexCode)) {
        continue;
      }
      const chunk = await provider.provide({ annexCode, generatedAt });
      if (chunk.scalars) {
        Object.assign(scalars, chunk.scalars);
      }
      if (chunk.collections) {
        Object.assign(collections, chunk.collections);
      }
    }

    return { scalars, collections };
  }
}
