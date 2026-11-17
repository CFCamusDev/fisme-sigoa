import type { StakeholderKind } from '../entities/stakeholder-enums.js';
import type { Stakeholder } from '../entities/stakeholder.js';
import {
  STAKEHOLDER_LIST_MEMBER_ACTIVITY_MAX_LENGTH,
  STAKEHOLDER_LIST_MEMBER_REPRESENTATIVE_MAX_LENGTH,
  type StakeholderListType,
} from '../entities/stakeholder-list-enums.js';
import { IncompleteListMemberError } from '../errors/incomplete-list-member-error.js';
import { InvalidStakeholderListDataError } from '../errors/invalid-stakeholder-list-data-error.js';

export interface StakeholderListMemberDetails {
  readonly activity?: string | null;
  readonly representative?: string | null;
}

export interface StakeholderListMemberSnapshotFields {
  readonly fullName: string;
  readonly institution: string | null;
  readonly ruc: string | null;
  readonly sector: string | null;
  readonly representative: string | null;
  readonly activity: string | null;
  readonly email: string | null;
  readonly mobile: string | null;
  readonly position: string | null;
  readonly graduationYear: number | null;
  readonly cycle: string | null;
}

type SnapshotFieldKey = Exclude<keyof StakeholderListMemberSnapshotFields, 'fullName'>;

interface TypeFieldRule {
  readonly allowedKinds: readonly StakeholderKind[];
  readonly kindMismatchMessage: string;
  readonly copiedFields: readonly SnapshotFieldKey[];
  readonly requiredFields: ReadonlyArray<{
    readonly key: SnapshotFieldKey;
    readonly label: string;
  }>;
}

const TYPE_FIELD_RULES: Record<StakeholderListType, TypeFieldRule> = {
  ADVISORY_BOARD: {
    allowedKinds: ['PERSON', 'INSTITUTION'],
    kindMismatchMessage: 'La lista de Comité Consultivo admite personas o instituciones.',
    copiedFields: ['institution', 'activity', 'email', 'mobile'],
    requiredFields: [
      { key: 'institution', label: 'institución' },
      { key: 'activity', label: 'actividad' },
      { key: 'email', label: 'correo' },
      { key: 'mobile', label: 'celular' },
    ],
  },
  EMPLOYER: {
    allowedKinds: ['INSTITUTION'],
    kindMismatchMessage: 'La lista de Empleadores solo admite instituciones registradas.',
    copiedFields: ['institution', 'ruc', 'sector', 'representative', 'email', 'mobile', 'position'],
    requiredFields: [
      { key: 'institution', label: 'institución' },
      { key: 'ruc', label: 'RUC' },
      { key: 'sector', label: 'sector' },
      { key: 'representative', label: 'representante' },
      { key: 'email', label: 'correo' },
      { key: 'mobile', label: 'celular' },
      { key: 'position', label: 'cargo' },
    ],
  },
  GRADUATE: {
    allowedKinds: ['PERSON'],
    kindMismatchMessage: 'La lista de Graduados solo admite personas registradas.',
    copiedFields: ['graduationYear', 'email', 'mobile'],
    requiredFields: [
      { key: 'graduationYear', label: 'año de egreso' },
      { key: 'email', label: 'correo' },
      { key: 'mobile', label: 'celular' },
    ],
  },
  STUDENT: {
    allowedKinds: ['PERSON'],
    kindMismatchMessage: 'La lista de Estudiantes solo admite personas registradas.',
    copiedFields: ['cycle', 'email', 'mobile'],
    requiredFields: [
      { key: 'cycle', label: 'ciclo' },
      { key: 'email', label: 'correo' },
      { key: 'mobile', label: 'celular' },
    ],
  },
  TEACHER: {
    allowedKinds: ['PERSON'],
    kindMismatchMessage: 'La lista de Docentes solo admite personas registradas.',
    copiedFields: ['email', 'mobile'],
    requiredFields: [
      { key: 'email', label: 'correo' },
      { key: 'mobile', label: 'celular' },
    ],
  },
};

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function validateDetailLength(
  value: string | null,
  maxLength: number,
  label: string,
): string | null {
  if (value !== null && value.length > maxLength) {
    throw new InvalidStakeholderListDataError(
      `${label} no puede exceder los ${maxLength} caracteres.`,
    );
  }
  return value;
}

/**
 * Aplica la política de campos del Anexo 3 por tipo de lista:
 * valida el tipo de constituyente, minimiza los campos copiados
 * y verifica los campos obligatorios en español.
 */
export function buildStakeholderListMemberSnapshot(
  listType: StakeholderListType,
  stakeholder: Stakeholder,
  details: StakeholderListMemberDetails = {},
): StakeholderListMemberSnapshotFields {
  const rule = TYPE_FIELD_RULES[listType];
  if (!rule.allowedKinds.includes(stakeholder.kind)) {
    throw new InvalidStakeholderListDataError(rule.kindMismatchMessage);
  }

  const activity = validateDetailLength(
    normalizeOptionalText(details.activity),
    STAKEHOLDER_LIST_MEMBER_ACTIVITY_MAX_LENGTH,
    'La actividad',
  );
  const representative = validateDetailLength(
    normalizeOptionalText(details.representative),
    STAKEHOLDER_LIST_MEMBER_REPRESENTATIVE_MAX_LENGTH,
    'El representante',
  );

  const institutionValue =
    stakeholder.kind === 'INSTITUTION' ? stakeholder.fullName : stakeholder.institution;

  const candidate: Omit<StakeholderListMemberSnapshotFields, 'fullName'> = {
    institution: institutionValue,
    ruc: stakeholder.ruc,
    sector: stakeholder.sector,
    representative,
    activity,
    email: stakeholder.email,
    mobile: stakeholder.mobile,
    position: stakeholder.position,
    graduationYear: stakeholder.graduationYear,
    cycle: stakeholder.cycle,
  };

  const copied = new Set<SnapshotFieldKey>(rule.copiedFields);
  const snapshot: StakeholderListMemberSnapshotFields = {
    fullName: stakeholder.fullName,
    institution: copied.has('institution') ? candidate.institution : null,
    ruc: copied.has('ruc') ? candidate.ruc : null,
    sector: copied.has('sector') ? candidate.sector : null,
    representative: copied.has('representative') ? candidate.representative : null,
    activity: copied.has('activity') ? candidate.activity : null,
    email: copied.has('email') ? candidate.email : null,
    mobile: copied.has('mobile') ? candidate.mobile : null,
    position: copied.has('position') ? candidate.position : null,
    graduationYear: copied.has('graduationYear') ? candidate.graduationYear : null,
    cycle: copied.has('cycle') ? candidate.cycle : null,
  };

  const missingFields = rule.requiredFields
    .filter(({ key }) => snapshot[key] === null)
    .map(({ label }) => label);

  if (missingFields.length > 0) {
    throw new IncompleteListMemberError(missingFields);
  }

  return snapshot;
}
