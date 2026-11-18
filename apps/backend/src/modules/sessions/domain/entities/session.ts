import { InvalidSessionDataError } from '../errors/invalid-session-data-error.js';
import { SessionStakeholderListMismatchError } from '../errors/session-stakeholder-list-mismatch-error.js';
import {
  assertExecutionsLinkable,
  type SessionProcessExecutionRef,
} from '../policies/session-execution-rule.js';
import {
  SESSION_DATE_YEAR_MAX,
  SESSION_DATE_YEAR_MIN,
  SESSION_MAX_EXECUTIONS,
  SESSION_URL_MAX,
  type SessionModality,
} from './session-modality.js';
import type { SessionStakeholderType } from './session-stakeholder-type.js';

export interface SessionStakeholderListInput {
  readonly id: string;
  readonly type: SessionStakeholderType;
}

export interface SessionProps {
  readonly id: string;
  readonly stakeholderType: SessionStakeholderType;
  readonly stakeholderListId: string | null;
  readonly sessionDate: string;
  readonly startTime: string;
  readonly modality: SessionModality;
  readonly meetingUrl: string | null;
  readonly recordingUrl: string | null;
  readonly executionIds: readonly string[];
  readonly createdBy: string;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateSessionInput {
  readonly id: string;
  readonly stakeholderType: SessionStakeholderType;
  readonly stakeholderList?: SessionStakeholderListInput | null;
  readonly sessionDate: string;
  readonly startTime: string;
  readonly modality: SessionModality;
  readonly meetingUrl?: string | null;
  readonly recordingUrl?: string | null;
  readonly executions: readonly SessionProcessExecutionRef[];
  readonly actorId: string;
  readonly now: Date;
}

export interface ApplySessionChangesInput {
  readonly stakeholderType?: SessionStakeholderType;
  readonly stakeholderList?: SessionStakeholderListInput | null;
  readonly sessionDate?: string;
  readonly startTime?: string;
  readonly modality?: SessionModality;
  readonly meetingUrl?: string | null;
  readonly recordingUrl?: string | null;
  readonly executions?: readonly SessionProcessExecutionRef[];
  readonly actorId: string;
  readonly now: Date;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function normalizeDate(raw: string): string {
  const normalized = raw.trim().replace(/\s+/g, '');
  const match = DATE_PATTERN.exec(normalized);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new InvalidSessionDataError('La fecha de la sesión debe tener formato AAAA-MM-DD');
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (year < SESSION_DATE_YEAR_MIN || year > SESSION_DATE_YEAR_MAX) {
    throw new InvalidSessionDataError(
      `El año de la sesión debe estar entre ${SESSION_DATE_YEAR_MIN} y ${SESSION_DATE_YEAR_MAX}`,
    );
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    throw new InvalidSessionDataError('La fecha de la sesión no corresponde a un día válido');
  }

  return normalized;
}

function normalizeStartTime(raw: string): string {
  const normalized = raw.trim().replace(/\s+/g, '');
  if (!TIME_PATTERN.test(normalized)) {
    throw new InvalidSessionDataError('La hora de inicio debe tener formato HH:mm (00:00 a 23:59)');
  }
  return normalized;
}

function normalizeUrl(raw: string | null | undefined, label: string): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const normalized = raw.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length > SESSION_URL_MAX) {
    throw new InvalidSessionDataError(`El ${label} no puede superar ${SESSION_URL_MAX} caracteres`);
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new InvalidSessionDataError(`El ${label} debe ser una URL válida`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidSessionDataError(`El ${label} debe usar protocolo http:// o https://`);
  }

  return normalized;
}

function validateModalitiesAndLinks(
  modality: SessionModality,
  meetingUrl: string | null,
  recordingUrl: string | null,
): void {
  if (modality === 'VIRTUAL' && (!meetingUrl || !recordingUrl)) {
    throw new InvalidSessionDataError(
      'Una sesión virtual requiere el enlace de la reunión y el enlace de la grabación',
    );
  }
}

function validateExecutions(executions: readonly SessionProcessExecutionRef[]): readonly string[] {
  if (executions.length > SESSION_MAX_EXECUTIONS) {
    throw new InvalidSessionDataError(
      `Una sesión no puede vincularse a más de ${SESSION_MAX_EXECUTIONS} ejecuciones`,
    );
  }
  assertExecutionsLinkable(executions);
  return executions.map((execution) => execution.id);
}

function validateStakeholderList(
  stakeholderType: SessionStakeholderType,
  stakeholderList: SessionStakeholderListInput | null | undefined,
): string | null {
  if (!stakeholderList) {
    return null;
  }
  if (stakeholderList.type !== stakeholderType) {
    throw new SessionStakeholderListMismatchError(stakeholderList.type, stakeholderType);
  }
  return stakeholderList.id;
}

export class Session {
  private constructor(private readonly props: SessionProps) {}

  static create(input: CreateSessionInput): Session {
    const executionIds = validateExecutions(input.executions);
    const stakeholderListId = validateStakeholderList(input.stakeholderType, input.stakeholderList);
    const sessionDate = normalizeDate(input.sessionDate);
    const startTime = normalizeStartTime(input.startTime);
    const meetingUrl = normalizeUrl(input.meetingUrl, 'enlace de reunión');
    const recordingUrl = normalizeUrl(input.recordingUrl, 'enlace de grabación');

    validateModalitiesAndLinks(input.modality, meetingUrl, recordingUrl);

    return new Session({
      id: input.id,
      stakeholderType: input.stakeholderType,
      stakeholderListId,
      sessionDate,
      startTime,
      modality: input.modality,
      meetingUrl,
      recordingUrl,
      executionIds,
      createdBy: input.actorId,
      updatedBy: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static rehydrate(props: SessionProps): Session {
    return new Session(props);
  }

  applyChanges(input: ApplySessionChangesInput): Session {
    const nextStakeholderType = input.stakeholderType ?? this.props.stakeholderType;
    const nextStakeholderListId =
      input.stakeholderList !== undefined
        ? validateStakeholderList(nextStakeholderType, input.stakeholderList)
        : this.props.stakeholderListId;

    const nextSessionDate =
      input.sessionDate !== undefined ? normalizeDate(input.sessionDate) : this.props.sessionDate;
    const nextStartTime =
      input.startTime !== undefined ? normalizeStartTime(input.startTime) : this.props.startTime;
    const nextModality = input.modality ?? this.props.modality;
    const nextMeetingUrl =
      input.meetingUrl !== undefined
        ? normalizeUrl(input.meetingUrl, 'enlace de reunión')
        : this.props.meetingUrl;
    const nextRecordingUrl =
      input.recordingUrl !== undefined
        ? normalizeUrl(input.recordingUrl, 'enlace de grabación')
        : this.props.recordingUrl;

    validateModalitiesAndLinks(nextModality, nextMeetingUrl, nextRecordingUrl);

    const nextExecutionIds =
      input.executions !== undefined
        ? validateExecutions(input.executions)
        : this.props.executionIds;

    return new Session({
      ...this.props,
      stakeholderType: nextStakeholderType,
      stakeholderListId: nextStakeholderListId,
      sessionDate: nextSessionDate,
      startTime: nextStartTime,
      modality: nextModality,
      meetingUrl: nextMeetingUrl,
      recordingUrl: nextRecordingUrl,
      executionIds: nextExecutionIds,
      updatedBy: input.actorId,
      updatedAt: input.now,
    });
  }

  snapshot(): Record<string, unknown> {
    return {
      id: this.props.id,
      stakeholderType: this.props.stakeholderType,
      stakeholderListId: this.props.stakeholderListId,
      sessionDate: this.props.sessionDate,
      startTime: this.props.startTime,
      modality: this.props.modality,
      meetingUrl: this.props.meetingUrl,
      recordingUrl: this.props.recordingUrl,
      executionIds: [...this.props.executionIds].sort(),
    };
  }

  get id(): string {
    return this.props.id;
  }

  get stakeholderType(): SessionStakeholderType {
    return this.props.stakeholderType;
  }

  get stakeholderListId(): string | null {
    return this.props.stakeholderListId;
  }

  get sessionDate(): string {
    return this.props.sessionDate;
  }

  get startTime(): string {
    return this.props.startTime;
  }

  get modality(): SessionModality {
    return this.props.modality;
  }

  get meetingUrl(): string | null {
    return this.props.meetingUrl;
  }

  get recordingUrl(): string | null {
    return this.props.recordingUrl;
  }

  get executionIds(): readonly string[] {
    return this.props.executionIds;
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
