import { resolutionDtoSchema, type ResolutionDto } from '@sigoa/shared';
import type { Resolution } from '../domain/entities/resolution.js';

/** DTO de una resolución; nunca se devuelve la entidad (AGENTS §4.2). */
export function mapResolutionToDto(resolution: Resolution): ResolutionDto {
  return {
    id: resolution.id,
    type: resolution.type,
    number: resolution.number,
    issuedOn: resolution.issuedOn.toISOString().slice(0, 10),
    status: resolution.status,
    catalogVersionId: resolution.catalogVersionId,
    pdfFileId: resolution.pdfFileId,
    approvedAt: resolution.approvedAt ? resolution.approvedAt.toISOString() : null,
    approvedBy: resolution.approvedBy,
    createdAt: resolution.createdAt.toISOString(),
    updatedAt: resolution.updatedAt.toISOString(),
  };
}

/** Mapea y valida el DTO contra el contrato; se llama antes de confirmar la transacción. */
export function buildResolutionDto(resolution: Resolution): ResolutionDto {
  return resolutionDtoSchema.parse(mapResolutionToDto(resolution));
}
