import { previewTemplateResponseSchema } from '@sigoa/shared';
import type { PdfGenerator } from '../../../shared/pdf/pdf-generator.js';
import { withEmptyPdfHeader } from '../../../shared/pdf/pdf-options.js';
import { TemplateNotFoundError, TemplatePreviewInProgressError } from '../domain/errors/index.js';
import {
  sanitizeTemplateContent,
  validateTemplateStructure,
} from '../domain/policies/template-content-policy.js';
import { renderTemplateHtml } from '../domain/policies/template-renderer.js';
import { buildTemplateSampleData } from '../domain/policies/template-sample-data.js';
import { detectUnrecognizedVariables } from '../domain/policies/unrecognized-variable-detector.js';
import type { TemplatePermissionChecker } from '../domain/ports/template-permission-checker.js';
import type { TemplateReader } from '../domain/ports/template-reader.js';
import type { PreviewTemplateCommand, PreviewTemplateResult } from './preview-template.types.js';

export const PREVIEW_FOOTER_TEMPLATE =
  '<div style="width:100%;text-align:center;font-size:8px;color:#475569;font-family:sans-serif;">Vista previa con datos de ejemplo · no es un documento oficial</div>';

export interface PreviewTemplateDependencies {
  readonly templateReader: TemplateReader;
  readonly permissionChecker: TemplatePermissionChecker;
  readonly pdfGenerator: PdfGenerator;
}

/**
 * Genera la vista previa en PDF de una plantilla con datos ficticios de ejemplo (HU-019, RF-019).
 * No persiste ni audita porque no modifica estado (D6); limita a una vista previa en vuelo por usuario (D9).
 */
export class PreviewTemplateUseCase {
  private readonly inFlightActors = new Set<string>();

  constructor(private readonly deps: PreviewTemplateDependencies) {}

  async execute(command: PreviewTemplateCommand): Promise<PreviewTemplateResult> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'plantilla.editar',
      scope: 'GLOBAL',
    });

    if (this.inFlightActors.has(command.actorId)) {
      throw new TemplatePreviewInProgressError();
    }

    this.inFlightActors.add(command.actorId);
    try {
      const template = await this.deps.templateReader.findById(command.templateId);
      if (!template) {
        throw new TemplateNotFoundError();
      }

      const sanitizedContent = sanitizeTemplateContent(command.content);
      validateTemplateStructure(sanitizedContent);

      const allowedKeys = template.variables.map((variable) => variable.key);
      const { unrecognized } = detectUnrecognizedVariables(sanitizedContent, allowedKeys);
      const sampleData = buildTemplateSampleData(sanitizedContent, template.variables);
      const html = renderTemplateHtml(sanitizedContent, sampleData);

      const pdfBuffer = await this.deps.pdfGenerator.render({
        html,
        options: withEmptyPdfHeader({
          format: 'A4',
          preferCSSPageSize: true,
          printBackground: true,
          displayHeaderFooter: true,
          footerTemplate: PREVIEW_FOOTER_TEMPLATE,
        }),
      });

      const warnings = unrecognized.slice(0, 100).map((variable) => ({
        variable: variable.slice(0, 80),
      }));

      return previewTemplateResponseSchema.parse({
        pdfBase64: pdfBuffer.toString('base64'),
        warnings,
      });
    } finally {
      this.inFlightActors.delete(command.actorId);
    }
  }
}
