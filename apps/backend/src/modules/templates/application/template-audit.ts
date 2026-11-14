import { computeSha256 } from '../../../shared/storage/file-hash.js';
import type { TemplateVersion } from '../domain/entities/template-version.js';

/**
 * Carga de auditoría de una versión: identifica el contenido por longitud y SHA-256, sin guardar
 * el HTML (la tabla `Audit` es append-only; ver D2 del plan).
 */
export type TemplateVersionAuditPayload = {
  readonly templateId: string;
  readonly number: number;
  readonly status: string;
  readonly contentLength: number;
  readonly contentSha256: string;
};

export function auditPayloadOf(version: TemplateVersion): TemplateVersionAuditPayload {
  return {
    ...version.snapshot(),
    contentLength: version.content.length,
    contentSha256: computeSha256(Buffer.from(version.content, 'utf8')),
  };
}
