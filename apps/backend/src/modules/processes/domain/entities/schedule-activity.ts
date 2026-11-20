import {
  SCHEDULE_ACTIVITY_MAX,
  SCHEDULE_GOAL_MAX,
  SCHEDULE_INDICATOR_MAX,
  SCHEDULE_RESPONSIBLE_MAX,
  SCHEDULE_YEAR_MAX,
  SCHEDULE_YEAR_MIN,
  type ScheduleActivityStatus,
} from './schedule-activity-status.js';
import { InvalidScheduleDataError } from '../errors/invalid-schedule-data-error.js';
import { InvalidScheduleTransitionError } from '../errors/invalid-schedule-transition-error.js';

export interface ScheduleActivityProps {
  readonly id: string;
  readonly processExecutionId: string;
  readonly number: number;
  readonly activity: string;
  readonly responsible: string;
  readonly goal: string | null;
  readonly indicator: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly status: ScheduleActivityStatus;
  readonly actualEndDate: string | null;
  readonly createdBy: string;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateScheduleActivityInput {
  readonly id: string;
  readonly executionId: string;
  readonly number: number;
  readonly activity: string;
  readonly responsible: string;
  readonly goal?: string | null;
  readonly indicator?: string | null;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly actorId: string;
  readonly now: Date;
}

export interface ApplyScheduleActivityChangesInput {
  readonly activity?: string;
  readonly responsible?: string;
  readonly goal?: string | null;
  readonly indicator?: string | null;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly actorId: string;
  readonly now: Date;
}

export interface StartScheduleActivityInput {
  readonly actorId: string;
  readonly now: Date;
}

export interface CompleteScheduleActivityInput {
  readonly actualEndDate?: string | null;
  readonly today: string;
  readonly actorId: string;
  readonly now: Date;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function normalizeRequiredText(raw: string, label: string, maxLength: number): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) {
    throw new InvalidScheduleDataError(`El campo ${label} es obligatorio.`);
  }
  if (trimmed.length > maxLength) {
    throw new InvalidScheduleDataError(
      `El campo ${label} no puede superar ${maxLength} caracteres.`,
    );
  }
  return trimmed;
}

function normalizeOptionalText(
  raw: string | null | undefined,
  label: string,
  maxLength: number,
): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new InvalidScheduleDataError(
      `El campo ${label} no puede superar ${maxLength} caracteres.`,
    );
  }
  return trimmed;
}

function normalizeOptionalIsoDate(raw: string | null | undefined, label: string): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const normalized = raw.trim();
  if (normalized.length === 0) {
    return null;
  }
  return assertValidIsoDate(normalized, label);
}

function assertValidIsoDate(raw: string, label: string): string {
  const normalized = raw.trim();
  const match = ISO_DATE_PATTERN.exec(normalized);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new InvalidScheduleDataError(`La ${label} debe tener formato AAAA-MM-DD.`);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (year < SCHEDULE_YEAR_MIN || year > SCHEDULE_YEAR_MAX) {
    throw new InvalidScheduleDataError(
      `El año de la ${label} debe estar entre ${SCHEDULE_YEAR_MIN} y ${SCHEDULE_YEAR_MAX}.`,
    );
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    throw new InvalidScheduleDataError(`La ${label} no corresponde a una fecha válida.`);
  }

  return normalized;
}

function assertValidNumber(number: number): void {
  if (!Number.isInteger(number) || number < 1) {
    throw new InvalidScheduleDataError(
      'El número de actividad debe ser un entero mayor o igual a 1.',
    );
  }
}

function assertDateRange(startDate: string | null, endDate: string | null): void {
  if (startDate !== null && endDate !== null && endDate < startDate) {
    throw new InvalidScheduleDataError(
      'La fecha de fin no puede ser anterior a la fecha de inicio.',
    );
  }
}

export class ScheduleActivity {
  private constructor(private readonly props: ScheduleActivityProps) {}

  static create(input: CreateScheduleActivityInput): ScheduleActivity {
    assertValidNumber(input.number);
    const activity = normalizeRequiredText(input.activity, 'actividad', SCHEDULE_ACTIVITY_MAX);
    const responsible = normalizeRequiredText(
      input.responsible,
      'responsable',
      SCHEDULE_RESPONSIBLE_MAX,
    );
    const goal = normalizeOptionalText(input.goal, 'meta', SCHEDULE_GOAL_MAX);
    const indicator = normalizeOptionalText(input.indicator, 'indicador', SCHEDULE_INDICATOR_MAX);
    const startDate = normalizeOptionalIsoDate(input.startDate, 'fecha de inicio');
    const endDate = normalizeOptionalIsoDate(input.endDate, 'fecha de fin');
    assertDateRange(startDate, endDate);

    return new ScheduleActivity({
      id: input.id,
      processExecutionId: input.executionId,
      number: input.number,
      activity,
      responsible,
      goal,
      indicator,
      startDate,
      endDate,
      status: 'PENDING',
      actualEndDate: null,
      createdBy: input.actorId,
      updatedBy: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static rehydrate(props: ScheduleActivityProps): ScheduleActivity {
    return new ScheduleActivity(props);
  }

  applyChanges(input: ApplyScheduleActivityChangesInput): ScheduleActivity {
    const activity =
      input.activity !== undefined
        ? normalizeRequiredText(input.activity, 'actividad', SCHEDULE_ACTIVITY_MAX)
        : this.props.activity;
    const responsible =
      input.responsible !== undefined
        ? normalizeRequiredText(input.responsible, 'responsable', SCHEDULE_RESPONSIBLE_MAX)
        : this.props.responsible;
    const goal =
      input.goal !== undefined
        ? normalizeOptionalText(input.goal, 'meta', SCHEDULE_GOAL_MAX)
        : this.props.goal;
    const indicator =
      input.indicator !== undefined
        ? normalizeOptionalText(input.indicator, 'indicador', SCHEDULE_INDICATOR_MAX)
        : this.props.indicator;
    const startDate =
      input.startDate !== undefined
        ? normalizeOptionalIsoDate(input.startDate, 'fecha de inicio')
        : this.props.startDate;
    const endDate =
      input.endDate !== undefined
        ? normalizeOptionalIsoDate(input.endDate, 'fecha de fin')
        : this.props.endDate;

    assertDateRange(startDate, endDate);

    if (
      this.props.actualEndDate !== null &&
      startDate !== null &&
      this.props.actualEndDate < startDate
    ) {
      throw new InvalidScheduleDataError(
        'La fecha real de término no puede ser anterior a la fecha de inicio.',
      );
    }

    return new ScheduleActivity({
      ...this.props,
      activity,
      responsible,
      goal,
      indicator,
      startDate,
      endDate,
      updatedBy: input.actorId,
      updatedAt: input.now,
    });
  }

  start(input: StartScheduleActivityInput): ScheduleActivity {
    if (this.props.status !== 'PENDING') {
      throw new InvalidScheduleTransitionError(
        'Solo se puede iniciar una actividad que está en estado Pendiente.',
      );
    }

    return new ScheduleActivity({
      ...this.props,
      status: 'IN_PROGRESS',
      updatedBy: input.actorId,
      updatedAt: input.now,
    });
  }

  complete(input: CompleteScheduleActivityInput): ScheduleActivity {
    if (this.props.status !== 'IN_PROGRESS') {
      throw new InvalidScheduleTransitionError(
        'Solo se puede completar una actividad que está en curso.',
      );
    }

    const today = assertValidIsoDate(input.today, 'fecha actual');
    const resolvedActualEndDate =
      input.actualEndDate !== undefined && input.actualEndDate !== null
        ? assertValidIsoDate(input.actualEndDate, 'fecha real de término')
        : today;

    if (resolvedActualEndDate > today) {
      throw new InvalidScheduleDataError('La fecha real de término no puede ser futura.');
    }

    if (this.props.startDate !== null && resolvedActualEndDate < this.props.startDate) {
      throw new InvalidScheduleDataError(
        'La fecha real de término no puede ser anterior a la fecha de inicio.',
      );
    }

    return new ScheduleActivity({
      ...this.props,
      status: 'COMPLETED',
      actualEndDate: resolvedActualEndDate,
      updatedBy: input.actorId,
      updatedAt: input.now,
    });
  }

  renumber(number: number, actorId?: string, now?: Date): ScheduleActivity {
    assertValidNumber(number);
    if (number === this.props.number) {
      return this;
    }
    return new ScheduleActivity({
      ...this.props,
      number,
      updatedBy: actorId ?? this.props.updatedBy,
      updatedAt: now ?? this.props.updatedAt,
    });
  }

  snapshot(): Record<string, unknown> {
    return {
      id: this.props.id,
      processExecutionId: this.props.processExecutionId,
      number: this.props.number,
      activity: this.props.activity,
      responsible: this.props.responsible,
      goal: this.props.goal,
      indicator: this.props.indicator,
      startDate: this.props.startDate,
      endDate: this.props.endDate,
      status: this.props.status,
      actualEndDate: this.props.actualEndDate,
    };
  }

  get id(): string {
    return this.props.id;
  }

  get processExecutionId(): string {
    return this.props.processExecutionId;
  }

  get number(): number {
    return this.props.number;
  }

  get activity(): string {
    return this.props.activity;
  }

  get responsible(): string {
    return this.props.responsible;
  }

  get goal(): string | null {
    return this.props.goal;
  }

  get indicator(): string | null {
    return this.props.indicator;
  }

  get startDate(): string | null {
    return this.props.startDate;
  }

  get endDate(): string | null {
    return this.props.endDate;
  }

  get status(): ScheduleActivityStatus {
    return this.props.status;
  }

  get actualEndDate(): string | null {
    return this.props.actualEndDate;
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
