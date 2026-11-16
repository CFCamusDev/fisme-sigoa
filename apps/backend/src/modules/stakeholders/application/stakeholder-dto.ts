import { stakeholderDtoSchema, type StakeholderDto } from '@sigoa/shared';
import type { Stakeholder } from '../domain/entities/stakeholder.js';

/** DTO de un constituyente; nunca se devuelve la entidad (AGENTS §4.2). */
export function mapStakeholderToDto(stakeholder: Stakeholder): StakeholderDto {
  return {
    id: stakeholder.id,
    kind: stakeholder.kind,
    fullName: stakeholder.fullName,
    dni: stakeholder.dni,
    ruc: stakeholder.ruc,
    email: stakeholder.email,
    mobile: stakeholder.mobile,
    position: stakeholder.position,
    institution: stakeholder.institution,
    sector: stakeholder.sector,
    graduationYear: stakeholder.graduationYear,
    cycle: stakeholder.cycle,
    status: stakeholder.status,
    voidReason: stakeholder.voidReason,
    voidedAt: stakeholder.voidedAt ? stakeholder.voidedAt.toISOString() : null,
    voidedBy: stakeholder.voidedBy,
    createdAt: stakeholder.createdAt.toISOString(),
    updatedAt: stakeholder.updatedAt.toISOString(),
  };
}

/** Mapea y valida el DTO contra el contrato; se llama antes de confirmar la transacción. */
export function buildStakeholderDto(stakeholder: Stakeholder): StakeholderDto {
  return stakeholderDtoSchema.parse(mapStakeholderToDto(stakeholder));
}
