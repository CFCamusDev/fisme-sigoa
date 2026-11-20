import type { StakeholderList } from '../entities/stakeholder-list.js';
import type { StakeholderListType } from '../entities/stakeholder-list-enums.js';
import type { StakeholderListMember } from '../entities/stakeholder-list-member.js';
import type { AnnexPdfRenderData } from '../ports/annex-pdf-generator.js';
import type { StakeholderListWithMembers } from '../ports/stakeholder-list-reader.js';

export const ANNEX3_MISSING_VALUE = '—';

export const ANNEX3_COLLECTION_KEYS: Readonly<Record<StakeholderListType, string>> = {
  ADVISORY_BOARD: 'advisory',
  EMPLOYER: 'employers',
  GRADUATE: 'graduates',
  STUDENT: 'students',
  TEACHER: 'teachers',
};

function orDash(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return ANNEX3_MISSING_VALUE;
  }
  const trimmed = value.trim();
  return trimmed === '' ? ANNEX3_MISSING_VALUE : trimmed;
}

type MemberRowMapper = (member: StakeholderListMember) => Readonly<Record<string, string>>;

const MEMBER_ROW_MAPPERS: Readonly<Record<StakeholderListType, MemberRowMapper>> = {
  ADVISORY_BOARD: (member) => ({
    activity: orDash(member.activity),
    institution: orDash(member.institution),
    email: orDash(member.email),
    phone: orDash(member.mobile),
  }),
  EMPLOYER: (member) => ({
    institution: orDash(member.institution),
    ruc: orDash(member.ruc),
    sector: orDash(member.sector),
    legalRepresentative: orDash(member.representative),
    email: orDash(member.email),
    phone: orDash(member.mobile),
    position: orDash(member.position),
  }),
  GRADUATE: (member) => ({
    name: orDash(member.fullName),
    graduationYear:
      member.graduationYear !== null ? String(member.graduationYear) : ANNEX3_MISSING_VALUE,
    email: orDash(member.email),
    contact: orDash(member.mobile),
  }),
  STUDENT: (member) => ({
    name: orDash(member.fullName),
    cycle: orDash(member.cycle),
    email: orDash(member.email),
    contact: orDash(member.mobile),
  }),
  TEACHER: (member) => ({
    name: orDash(member.fullName),
    email: orDash(member.email),
    contact: orDash(member.mobile),
  }),
};

/**
 * Construye los escalares y las cinco colecciones del Anexo 3 (FO-03)
 * consolidando las listas del programa y año de la lista solicitada (D2, D8).
 */
export function buildAnnex3RenderData(
  requestedList: StakeholderList,
  listsOfYear: readonly StakeholderListWithMembers[],
): AnnexPdfRenderData {
  const scalars: Record<string, string> = {
    'studyPlan.number': orDash(requestedList.studyPlanNumber),
    'studyPlan.year': String(requestedList.year),
    'list.version': orDash(requestedList.version),
  };

  const collections: Record<string, Readonly<Record<string, string>>[]> = {
    advisory: [],
    employers: [],
    graduates: [],
    students: [],
    teachers: [],
  };

  for (const entry of listsOfYear) {
    const collectionKey = ANNEX3_COLLECTION_KEYS[entry.list.type];
    const mapMember = MEMBER_ROW_MAPPERS[entry.list.type];
    const target = collections[collectionKey];
    if (!target) {
      continue;
    }
    for (const member of entry.members) {
      target.push(mapMember(member));
    }
  }

  return { scalars, collections };
}
