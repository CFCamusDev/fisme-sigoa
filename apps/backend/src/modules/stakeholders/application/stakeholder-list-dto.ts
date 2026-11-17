import {
  stakeholderListDtoSchema,
  stakeholderListMemberDtoSchema,
  type StakeholderListDto,
  type StakeholderListMemberDto,
} from '@sigoa/shared';
import type { StakeholderListMember } from '../domain/entities/stakeholder-list-member.js';
import type { StakeholderList } from '../domain/entities/stakeholder-list.js';

/** DTO de un miembro de lista del Anexo 3; nunca se devuelve la entidad (AGENTS §4.2). */
export function mapStakeholderListMemberToDto(
  member: StakeholderListMember,
): StakeholderListMemberDto {
  return {
    id: member.id,
    listId: member.listId,
    stakeholderId: member.stakeholderId,
    fullName: member.fullName,
    institution: member.institution,
    ruc: member.ruc,
    sector: member.sector,
    representative: member.representative,
    activity: member.activity,
    email: member.email,
    mobile: member.mobile,
    position: member.position,
    graduationYear: member.graduationYear,
    cycle: member.cycle,
    createdAt: member.createdAt.toISOString(),
  };
}

/** Mapea y valida el DTO del miembro contra el contrato antes de confirmar la transacción. */
export function buildStakeholderListMemberDto(
  member: StakeholderListMember,
): StakeholderListMemberDto {
  return stakeholderListMemberDtoSchema.parse(mapStakeholderListMemberToDto(member));
}

/** DTO de una lista del Anexo 3; nunca se devuelve la entidad (AGENTS §4.2). */
export function mapStakeholderListToDto(
  list: StakeholderList,
  memberCount: number,
  members: readonly StakeholderListMember[] | null,
): StakeholderListDto {
  return {
    id: list.id,
    programId: list.programId,
    type: list.type,
    year: list.year,
    studyPlanNumber: list.studyPlanNumber,
    version: list.version,
    memberCount,
    members: members ? members.map(mapStakeholderListMemberToDto) : null,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  };
}

/** Mapea y valida el DTO de la lista contra el contrato antes de confirmar la transacción. */
export function buildStakeholderListDto(
  list: StakeholderList,
  memberCount: number,
  members: readonly StakeholderListMember[] | null,
): StakeholderListDto {
  return stakeholderListDtoSchema.parse(mapStakeholderListToDto(list, memberCount, members));
}
