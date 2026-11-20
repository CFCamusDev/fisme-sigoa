import type {
  CurrentQualityCommitteeResponse,
  QualityCommitteeDto,
  QualityCommitteeListResponse,
} from '@sigoa/shared';

export const SAMPLE_CURRENT_COMMITTEE: QualityCommitteeDto = {
  id: 'com-2027',
  periodStart: '2027-01-01',
  periodEnd: '2027-12-31',
  isCurrent: true,
  members: [
    {
      id: 'mem-1',
      fullName: 'Ana Torres',
      degree: 'Dr.',
      position: 'PRESIDENT',
      userId: 'usr-1',
      linkedUserName: 'Ana Torres Quispe',
    },
    {
      id: 'mem-2',
      fullName: 'Carlos Méndez',
      degree: 'Mg.',
      position: 'MEMBER',
      userId: null,
      linkedUserName: null,
    },
  ],
};

export const SAMPLE_FINISHED_COMMITTEE: QualityCommitteeDto = {
  id: 'com-2025',
  periodStart: '2025-01-01',
  periodEnd: '2025-12-31',
  isCurrent: false,
  members: [
    {
      id: 'mem-old-1',
      fullName: 'Pedro Salas',
      degree: 'Dr.',
      position: 'PRESIDENT',
      userId: 'usr-old',
      linkedUserName: 'Pedro Salas',
    },
  ],
};

export function makeCurrentCommitteeResponse(
  overrides: Partial<CurrentQualityCommitteeResponse> = {},
): CurrentQualityCommitteeResponse {
  return {
    committee: SAMPLE_CURRENT_COMMITTEE,
    actorMembership: null,
    alerts: [],
    ...overrides,
  };
}

export function makeCommitteeListResponse(
  overrides: Partial<QualityCommitteeListResponse> = {},
): QualityCommitteeListResponse {
  return {
    items: [SAMPLE_CURRENT_COMMITTEE, SAMPLE_FINISHED_COMMITTEE],
    page: 1,
    pageSize: 10,
    total: 2,
    ...overrides,
  };
}
