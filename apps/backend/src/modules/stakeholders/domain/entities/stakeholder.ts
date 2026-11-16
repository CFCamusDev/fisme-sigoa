import { InvalidStakeholderDataError } from '../errors/invalid-stakeholder-data-error.js';
import { assertCanEdit, assertCanVoid } from '../policies/stakeholder-state-machine.js';
import {
  STAKEHOLDER_CYCLE_MAX_LENGTH,
  STAKEHOLDER_DNI_PATTERN,
  STAKEHOLDER_EMAIL_MAX_LENGTH,
  STAKEHOLDER_EMAIL_PATTERN,
  STAKEHOLDER_FULL_NAME_MAX_LENGTH,
  STAKEHOLDER_GRADUATION_YEAR_MAX,
  STAKEHOLDER_GRADUATION_YEAR_MIN,
  STAKEHOLDER_INSTITUTION_MAX_LENGTH,
  STAKEHOLDER_KINDS,
  STAKEHOLDER_MOBILE_PATTERN,
  STAKEHOLDER_POSITION_MAX_LENGTH,
  STAKEHOLDER_RUC_PATTERN,
  STAKEHOLDER_SECTOR_MAX_LENGTH,
  STAKEHOLDER_STATUSES,
  STAKEHOLDER_VOID_REASON_MAX_LENGTH,
  STAKEHOLDER_VOID_REASON_MIN_LENGTH,
  type StakeholderKind,
  type StakeholderStatus,
} from './stakeholder-enums.js';

export interface StakeholderProperties {
  readonly id: string;
  readonly kind: StakeholderKind;
  readonly fullName: string;
  readonly dni: string | null;
  readonly ruc: string | null;
  readonly email: string | null;
  readonly mobile: string | null;
  readonly position: string | null;
  readonly institution: string | null;
  readonly sector: string | null;
  readonly graduationYear: number | null;
  readonly cycle: string | null;
  readonly status: StakeholderStatus;
  readonly voidReason: string | null;
  readonly voidedAt: Date | null;
  readonly voidedBy: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RegisterStakeholderInput {
  id: string;
  kind: StakeholderKind;
  fullName: string;
  dni?: string | null;
  ruc?: string | null;
  email?: string | null;
  mobile?: string | null;
  position?: string | null;
  institution?: string | null;
  sector?: string | null;
  graduationYear?: number | null;
  cycle?: string | null;
  actorId: string;
  now?: Date;
}

export interface EditStakeholderInput {
  fullName?: string;
  dni?: string | null;
  ruc?: string | null;
  email?: string | null;
  mobile?: string | null;
  position?: string | null;
  institution?: string | null;
  sector?: string | null;
  graduationYear?: number | null;
  cycle?: string | null;
  now?: Date;
}

export interface VoidStakeholderInput {
  reason: string;
  actorId: string;
  now?: Date;
}

/** Alias de tipo para cumplir con el contrato de auditoría sin exponer correo ni celular (D6, RNF-012). */
export type StakeholderSnapshot = {
  readonly kind: StakeholderKind;
  readonly fullName: string;
  readonly dni: string | null;
  readonly ruc: string | null;
  readonly hasEmail: boolean;
  readonly hasMobile: boolean;
  readonly position: string | null;
  readonly institution: string | null;
  readonly sector: string | null;
  readonly graduationYear: number | null;
  readonly cycle: string | null;
  readonly status: StakeholderStatus;
};

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function validateBoundedText(
  value: string | null,
  maxLength: number,
  label: string,
): string | null {
  if (value !== null && value.length > maxLength) {
    throw new InvalidStakeholderDataError(`${label} no puede exceder los ${maxLength} caracteres.`);
  }
  return value;
}

function validateOptionalEmail(rawEmail: string | null | undefined): string | null {
  const normalized = normalizeOptionalString(rawEmail);
  if (normalized === null) {
    return null;
  }
  const lower = normalized.toLowerCase();
  if (lower.length > STAKEHOLDER_EMAIL_MAX_LENGTH || !STAKEHOLDER_EMAIL_PATTERN.test(lower)) {
    throw new InvalidStakeholderDataError('El correo electrónico no tiene un formato válido.');
  }
  return lower;
}

function validateOptionalMobile(rawMobile: string | null | undefined): string | null {
  const normalized = normalizeOptionalString(rawMobile);
  if (normalized === null) {
    return null;
  }
  if (!STAKEHOLDER_MOBILE_PATTERN.test(normalized)) {
    throw new InvalidStakeholderDataError('El celular debe tener 9 dígitos e iniciar con 9.');
  }
  return normalized;
}

function validateNormalizedFields(fields: {
  kind: StakeholderKind;
  fullName: string;
  dni: string | null;
  ruc: string | null;
  email: string | null;
  mobile: string | null;
  position: string | null;
  institution: string | null;
  sector: string | null;
  graduationYear: number | null;
  cycle: string | null;
}): void {
  if (fields.fullName.length < 1 || fields.fullName.length > STAKEHOLDER_FULL_NAME_MAX_LENGTH) {
    throw new InvalidStakeholderDataError(
      `El nombre completo o razón social debe tener entre 1 y ${STAKEHOLDER_FULL_NAME_MAX_LENGTH} caracteres.`,
    );
  }

  validateBoundedText(fields.position, STAKEHOLDER_POSITION_MAX_LENGTH, 'El cargo');
  validateBoundedText(fields.sector, STAKEHOLDER_SECTOR_MAX_LENGTH, 'El sector');

  if (fields.kind === 'PERSON') {
    if (fields.dni === null || !STAKEHOLDER_DNI_PATTERN.test(fields.dni)) {
      throw new InvalidStakeholderDataError('Una persona requiere un DNI válido de 8 dígitos.');
    }
    if (fields.ruc !== null) {
      throw new InvalidStakeholderDataError('Una persona no puede registrar RUC.');
    }
    validateBoundedText(fields.institution, STAKEHOLDER_INSTITUTION_MAX_LENGTH, 'La institución');
    validateBoundedText(fields.cycle, STAKEHOLDER_CYCLE_MAX_LENGTH, 'El ciclo');
    if (fields.graduationYear !== null) {
      if (
        !Number.isInteger(fields.graduationYear) ||
        fields.graduationYear < STAKEHOLDER_GRADUATION_YEAR_MIN ||
        fields.graduationYear > STAKEHOLDER_GRADUATION_YEAR_MAX
      ) {
        throw new InvalidStakeholderDataError(
          `El año de egreso debe ser un entero entre ${STAKEHOLDER_GRADUATION_YEAR_MIN} y ${STAKEHOLDER_GRADUATION_YEAR_MAX}.`,
        );
      }
    }
    return;
  }

  if (fields.ruc === null || !STAKEHOLDER_RUC_PATTERN.test(fields.ruc)) {
    throw new InvalidStakeholderDataError('Una institución requiere un RUC válido de 11 dígitos.');
  }
  if (fields.dni !== null) {
    throw new InvalidStakeholderDataError('Una institución no puede registrar DNI.');
  }
  if (fields.institution !== null) {
    throw new InvalidStakeholderDataError(
      'Una institución no admite el campo institución adicional.',
    );
  }
  if (fields.graduationYear !== null) {
    throw new InvalidStakeholderDataError('Una institución no admite año de egreso.');
  }
  if (fields.cycle !== null) {
    throw new InvalidStakeholderDataError('Una institución no admite ciclo.');
  }
}

export class Stakeholder {
  private constructor(private readonly props: StakeholderProperties) {}

  /** Reconstruye un constituyente ya persistido. */
  public static create(rawProps: StakeholderProperties): Stakeholder {
    if (!STAKEHOLDER_KINDS.includes(rawProps.kind)) {
      throw new InvalidStakeholderDataError('El tipo de constituyente no es válido.');
    }
    if (!STAKEHOLDER_STATUSES.includes(rawProps.status)) {
      throw new InvalidStakeholderDataError('El estado del constituyente no es válido.');
    }
    return new Stakeholder(rawProps);
  }

  public static register(input: RegisterStakeholderInput): Stakeholder {
    if (!STAKEHOLDER_KINDS.includes(input.kind)) {
      throw new InvalidStakeholderDataError('El tipo de constituyente no es válido.');
    }

    const fullName = input.fullName.trim();
    const dni = normalizeOptionalString(input.dni);
    const ruc = normalizeOptionalString(input.ruc);
    const email = validateOptionalEmail(input.email);
    const mobile = validateOptionalMobile(input.mobile);
    const position = normalizeOptionalString(input.position);
    const institution = normalizeOptionalString(input.institution);
    const sector = normalizeOptionalString(input.sector);
    const graduationYear = input.graduationYear ?? null;
    const cycle = normalizeOptionalString(input.cycle);

    validateNormalizedFields({
      kind: input.kind,
      fullName,
      dni,
      ruc,
      email,
      mobile,
      position,
      institution,
      sector,
      graduationYear,
      cycle,
    });

    const now = input.now ?? new Date();
    return Stakeholder.create({
      id: input.id,
      kind: input.kind,
      fullName,
      dni,
      ruc,
      email,
      mobile,
      position,
      institution,
      sector,
      graduationYear,
      cycle,
      status: 'ACTIVE',
      voidReason: null,
      voidedAt: null,
      voidedBy: null,
      createdBy: input.actorId,
      createdAt: now,
      updatedAt: now,
    });
  }

  public get id(): string {
    return this.props.id;
  }

  public get kind(): StakeholderKind {
    return this.props.kind;
  }

  public get fullName(): string {
    return this.props.fullName;
  }

  public get dni(): string | null {
    return this.props.dni;
  }

  public get ruc(): string | null {
    return this.props.ruc;
  }

  public get email(): string | null {
    return this.props.email;
  }

  public get mobile(): string | null {
    return this.props.mobile;
  }

  public get position(): string | null {
    return this.props.position;
  }

  public get institution(): string | null {
    return this.props.institution;
  }

  public get sector(): string | null {
    return this.props.sector;
  }

  public get graduationYear(): number | null {
    return this.props.graduationYear;
  }

  public get cycle(): string | null {
    return this.props.cycle;
  }

  public get status(): StakeholderStatus {
    return this.props.status;
  }

  public get voidReason(): string | null {
    return this.props.voidReason;
  }

  public get voidedAt(): Date | null {
    return this.props.voidedAt;
  }

  public get voidedBy(): string | null {
    return this.props.voidedBy;
  }

  public get createdBy(): string {
    return this.props.createdBy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public edit(input: EditStakeholderInput): Stakeholder {
    assertCanEdit(this.props.status);

    const fullName = input.fullName !== undefined ? input.fullName.trim() : this.props.fullName;
    const dni = input.dni !== undefined ? normalizeOptionalString(input.dni) : this.props.dni;
    const ruc = input.ruc !== undefined ? normalizeOptionalString(input.ruc) : this.props.ruc;
    const email = input.email !== undefined ? validateOptionalEmail(input.email) : this.props.email;
    const mobile =
      input.mobile !== undefined ? validateOptionalMobile(input.mobile) : this.props.mobile;
    const position =
      input.position !== undefined ? normalizeOptionalString(input.position) : this.props.position;
    const institution =
      input.institution !== undefined
        ? normalizeOptionalString(input.institution)
        : this.props.institution;
    const sector =
      input.sector !== undefined ? normalizeOptionalString(input.sector) : this.props.sector;
    const graduationYear =
      input.graduationYear !== undefined ? input.graduationYear : this.props.graduationYear;
    const cycle =
      input.cycle !== undefined ? normalizeOptionalString(input.cycle) : this.props.cycle;

    validateNormalizedFields({
      kind: this.props.kind,
      fullName,
      dni,
      ruc,
      email,
      mobile,
      position,
      institution,
      sector,
      graduationYear,
      cycle,
    });

    return Stakeholder.create({
      ...this.props,
      fullName,
      dni,
      ruc,
      email,
      mobile,
      position,
      institution,
      sector,
      graduationYear,
      cycle,
      updatedAt: input.now ?? new Date(),
    });
  }

  public void(input: VoidStakeholderInput): Stakeholder {
    assertCanVoid(this.props.status);

    const reason = input.reason.trim();
    if (
      reason.length < STAKEHOLDER_VOID_REASON_MIN_LENGTH ||
      reason.length > STAKEHOLDER_VOID_REASON_MAX_LENGTH
    ) {
      throw new InvalidStakeholderDataError(
        `El motivo de anulación debe tener entre ${STAKEHOLDER_VOID_REASON_MIN_LENGTH} y ${STAKEHOLDER_VOID_REASON_MAX_LENGTH} caracteres.`,
      );
    }

    const now = input.now ?? new Date();
    return Stakeholder.create({
      ...this.props,
      status: 'VOIDED',
      voidReason: reason,
      voidedAt: now,
      voidedBy: input.actorId,
      updatedAt: now,
    });
  }

  public snapshot(): StakeholderSnapshot {
    return {
      kind: this.props.kind,
      fullName: this.props.fullName,
      dni: this.props.dni,
      ruc: this.props.ruc,
      hasEmail: this.props.email !== null,
      hasMobile: this.props.mobile !== null,
      position: this.props.position,
      institution: this.props.institution,
      sector: this.props.sector,
      graduationYear: this.props.graduationYear,
      cycle: this.props.cycle,
      status: this.props.status,
    };
  }
}
