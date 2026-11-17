import {
  PROCESS_EXECUTION_NAME_MAX,
  PROCESS_EXECUTION_YEAR_MAX,
  PROCESS_EXECUTION_YEAR_MIN,
  type ProcessExecutionStatus,
} from './process-execution-status.js';
import {
  PROCESS_TYPE_RULES,
  buildDefaultProcessExecutionName,
  type ProcessType,
} from './process-type.js';
import { InvalidProcessExecutionDataError } from '../errors/invalid-process-execution-data-error.js';
import {
  assertCatalogVersionAllowed,
  type ProcessCatalogVersionRef,
} from '../policies/process-catalog-version-rule.js';

export interface ProcessExecutionProps {
  readonly id: string;
  readonly programId: string;
  readonly type: ProcessType;
  readonly name: string;
  readonly year: number;
  readonly semesterId: string | null;
  readonly catalogVersionId: string;
  readonly status: ProcessExecutionStatus;
  readonly createdBy: string;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateProcessExecutionInput {
  readonly id: string;
  readonly programId: string;
  readonly type: ProcessType;
  readonly name?: string | null;
  readonly year: number;
  readonly semester?: { readonly id: string; readonly code: string } | null;
  readonly catalogVersion: ProcessCatalogVersionRef;
  readonly actorId: string;
  readonly now: Date;
}

function normalizeName(raw?: string | null): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const normalized = raw.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}

function parseSemesterYear(code: string): number | null {
  const match = /^(\d{4})-/.exec(code.trim());
  if (!match?.[1]) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

export class ProcessExecution {
  private constructor(private readonly props: ProcessExecutionProps) {}

  static create(input: CreateProcessExecutionInput): ProcessExecution {
    if (
      !Number.isInteger(input.year) ||
      input.year < PROCESS_EXECUTION_YEAR_MIN ||
      input.year > PROCESS_EXECUTION_YEAR_MAX
    ) {
      throw new InvalidProcessExecutionDataError(
        `El año debe estar entre ${PROCESS_EXECUTION_YEAR_MIN} y ${PROCESS_EXECUTION_YEAR_MAX}`,
      );
    }

    const rule = PROCESS_TYPE_RULES[input.type];
    if (rule.periodKind === 'SEMESTER') {
      if (!input.semester) {
        throw new InvalidProcessExecutionDataError(
          `El proceso ${input.type} requiere seleccionar un semestre`,
        );
      }
      const semesterYear = parseSemesterYear(input.semester.code);
      if (semesterYear !== null && semesterYear !== input.year) {
        throw new InvalidProcessExecutionDataError(
          `El año (${input.year}) debe coincidir con el año del semestre (${input.semester.code})`,
        );
      }
    } else if (input.semester) {
      throw new InvalidProcessExecutionDataError(
        `El proceso ${input.type} es anual y no admite un semestre`,
      );
    }

    assertCatalogVersionAllowed(input.type, input.catalogVersion, input.programId);

    const customName = normalizeName(input.name);
    const resolvedName =
      customName ??
      buildDefaultProcessExecutionName(input.type, input.year, input.semester?.code ?? null);

    if (resolvedName.length > PROCESS_EXECUTION_NAME_MAX) {
      throw new InvalidProcessExecutionDataError(
        `El nombre no puede superar ${PROCESS_EXECUTION_NAME_MAX} caracteres`,
      );
    }

    return new ProcessExecution({
      id: input.id,
      programId: input.programId,
      type: input.type,
      name: resolvedName,
      year: input.year,
      semesterId: input.semester?.id ?? null,
      catalogVersionId: input.catalogVersion.id,
      status: 'PLANNED',
      createdBy: input.actorId,
      updatedBy: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static rehydrate(props: ProcessExecutionProps): ProcessExecution {
    return new ProcessExecution(props);
  }

  snapshot(): Record<string, unknown> {
    return {
      id: this.props.id,
      programId: this.props.programId,
      type: this.props.type,
      name: this.props.name,
      year: this.props.year,
      semesterId: this.props.semesterId,
      catalogVersionId: this.props.catalogVersionId,
      status: this.props.status,
    };
  }

  get id(): string {
    return this.props.id;
  }

  get programId(): string {
    return this.props.programId;
  }

  get type(): ProcessType {
    return this.props.type;
  }

  get name(): string {
    return this.props.name;
  }

  get year(): number {
    return this.props.year;
  }

  get semesterId(): string | null {
    return this.props.semesterId;
  }

  get catalogVersionId(): string {
    return this.props.catalogVersionId;
  }

  get status(): ProcessExecutionStatus {
    return this.props.status;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  get updatedBy(): string | null {
    return this.props.updatedBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
