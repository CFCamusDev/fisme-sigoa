import type {
  ListSessionsResponse,
  ProcessExecutionDto,
  SessionAttendeeRosterItem,
  SessionAttendeesResponse,
  SessionDto,
} from '@sigoa/shared';

export const SAMPLE_SESSION_DTO: SessionDto = {
  id: 'sess-1',
  stakeholderType: 'EMPLOYER',
  stakeholderListId: 'list-1',
  sessionDate: '2026-11-20',
  startTime: '10:00',
  modality: 'VIRTUAL',
  meetingUrl: 'https://meet.example.com/emp-2026',
  recordingUrl: 'https://drive.example.com/emp-2026',
  executionIds: ['exec-1', 'exec-2', 'exec-3'],
  createdAt: '2026-11-17T15:00:00.000Z',
  updatedAt: '2026-11-17T15:00:00.000Z',
};

export function makeSessionsResponse(
  items: readonly SessionDto[] = [SAMPLE_SESSION_DTO],
  overrides?: Partial<ListSessionsResponse>,
): ListSessionsResponse {
  return {
    items: [...items],
    total: overrides?.total ?? items.length,
    page: overrides?.page ?? 1,
    pageSize: overrides?.pageSize ?? 20,
  };
}

export const SAMPLE_OPEN_EXECUTIONS: readonly ProcessExecutionDto[] = [
  {
    id: 'exec-1',
    type: 'P613',
    name: 'Revisión OE 2026',
    year: 2026,
    semesterId: null,
    semesterCode: null,
    catalogVersionId: 'cv-1',
    catalogVersionNumber: 1,
    status: 'PLANNED',
    voidReason: null,
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
  },
  {
    id: 'exec-2',
    type: 'P612',
    name: 'Medición OE 2026',
    year: 2026,
    semesterId: null,
    semesterCode: null,
    catalogVersionId: 'cv-1',
    catalogVersionNumber: 1,
    status: 'IN_PROGRESS',
    voidReason: null,
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
  },
  {
    id: 'exec-3',
    type: 'P623',
    name: 'Medición indirecta AG 2026',
    year: 2026,
    semesterId: null,
    semesterCode: null,
    catalogVersionId: 'cv-1',
    catalogVersionNumber: 1,
    status: 'PLANNED',
    voidReason: null,
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
  },
];

export const SAMPLE_ATTENDEE_ROSTER: readonly SessionAttendeeRosterItem[] = [
  {
    listMemberId: 'mem-1',
    fullName: 'Ana Pérez',
    institution: 'Empresa A',
    memberPosition: 'Analista',
    attended: true,
    position: 'Gerente de TI',
  },
  {
    listMemberId: 'mem-2',
    fullName: 'Luis Torres',
    institution: 'Empresa B',
    memberPosition: 'Jefe de Área',
    attended: false,
    position: null,
  },
];

export function makeSessionAttendeesResponse(
  overrides?: Partial<SessionAttendeesResponse>,
): SessionAttendeesResponse {
  const items = overrides?.items ?? [...SAMPLE_ATTENDEE_ROSTER];
  return {
    sessionId: overrides?.sessionId ?? 'sess-1',
    stakeholderListId:
      overrides && 'stakeholderListId' in overrides
        ? (overrides.stakeholderListId ?? null)
        : 'list-1',
    attendeeCount: overrides?.attendeeCount ?? items.filter((item) => item.attended).length,
    items,
  };
}
