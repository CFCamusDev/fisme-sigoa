import { responseScaleDtoSchema, type ResponseScaleDto } from '@sigoa/shared';
import type { ResponseScale } from '../domain/entities/response-scale.js';

/** DTO de una escala con sus niveles; nunca se devuelve la entidad (AGENTS §4.2). */
export function mapResponseScaleToDto(scale: ResponseScale, inUse: boolean): ResponseScaleDto {
  return {
    id: scale.id,
    code: scale.code,
    name: scale.name,
    type: scale.type,
    inUse,
    levels: scale.levels.map((level) => ({
      order: level.order,
      label: level.label,
      value: level.value,
      countsAsAchievement: level.countsAsAchievement,
    })),
  };
}

/** Mapea y valida el DTO contra el contrato; se llama antes de confirmar la transacción. */
export function buildResponseScaleDto(scale: ResponseScale, inUse: boolean): ResponseScaleDto {
  return responseScaleDtoSchema.parse(mapResponseScaleToDto(scale, inUse));
}
