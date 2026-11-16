import { InvalidStakeholderListDataError } from '../errors/invalid-stakeholder-list-data-error.js';
import {
  STAKEHOLDER_LIST_STUDY_PLAN_NUMBER_MAX_LENGTH,
  STAKEHOLDER_LIST_TYPES,
  STAKEHOLDER_LIST_VERSION_MAX_LENGTH,
  STAKEHOLDER_LIST_YEAR_MAX,
  STAKEHOLDER_LIST_YEAR_MIN,
  type StakeholderListType,
} from './stakeholder-list-enums.js';

export interface StakeholderListProperties {
  readonly id: string;
  readonly programId: string;
  readonly type: StakeholderListType;
  readonly year: number;
  readonly studyPlanNumber: string | null;
  readonly version: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateStakeholderListInput {
  readonly id: string;
  readonly programId: string;
  readonly type: StakeholderListType;
  readonly year: number;
  readonly studyPlanNumber?: string | null;
  readonly version?: string | null;
  readonly actorId: string;
  readonly now?: Date;
}

/** Alias de tipo para cumplir con el contrato de auditoría (`Record<string, unknown>`). */
export type StakeholderListAuditSnapshot = {
  readonly programId: string;
  readonly type: StakeholderListType;
  readonly year: number;
  readonly studyPlanNumber: string | null;
  readonly version: string | null;
};

function normalizeOptionalHeaderField(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function validateHeaderLength(
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

export class StakeholderList {
  private constructor(private readonly props: StakeholderListProperties) {}

  /** Reconstruye una lista ya persistida sin revalidar datos históricos. */
  public static reconstitute(props: StakeholderListProperties): StakeholderList {
    return new StakeholderList(props);
  }

  public static create(input: CreateStakeholderListInput): StakeholderList {
    if (!STAKEHOLDER_LIST_TYPES.includes(input.type)) {
      throw new InvalidStakeholderListDataError('El tipo de lista de constituyentes no es válido.');
    }

    if (
      !Number.isInteger(input.year) ||
      input.year < STAKEHOLDER_LIST_YEAR_MIN ||
      input.year > STAKEHOLDER_LIST_YEAR_MAX
    ) {
      throw new InvalidStakeholderListDataError(
        `El año de la lista debe ser un entero entre ${STAKEHOLDER_LIST_YEAR_MIN} y ${STAKEHOLDER_LIST_YEAR_MAX}.`,
      );
    }

    const studyPlanNumber = validateHeaderLength(
      normalizeOptionalHeaderField(input.studyPlanNumber),
      STAKEHOLDER_LIST_STUDY_PLAN_NUMBER_MAX_LENGTH,
      'El número de plan de estudios',
    );
    const version = validateHeaderLength(
      normalizeOptionalHeaderField(input.version),
      STAKEHOLDER_LIST_VERSION_MAX_LENGTH,
      'La versión de la lista',
    );

    const now = input.now ?? new Date();
    return new StakeholderList({
      id: input.id,
      programId: input.programId,
      type: input.type,
      year: input.year,
      studyPlanNumber,
      version,
      createdBy: input.actorId,
      createdAt: now,
      updatedAt: now,
    });
  }

  public get id(): string {
    return this.props.id;
  }

  public get programId(): string {
    return this.props.programId;
  }

  public get type(): StakeholderListType {
    return this.props.type;
  }

  public get year(): number {
    return this.props.year;
  }

  public get studyPlanNumber(): string | null {
    return this.props.studyPlanNumber;
  }

  public get version(): string | null {
    return this.props.version;
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

  public snapshot(): StakeholderListAuditSnapshot {
    return {
      programId: this.props.programId,
      type: this.props.type,
      year: this.props.year,
      studyPlanNumber: this.props.studyPlanNumber,
      version: this.props.version,
    };
  }
}
