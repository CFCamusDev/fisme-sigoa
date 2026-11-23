import type {
  CatalogVersionDto,
  ListProcessExecutionsResponse,
  ProcessExecutionDto,
  SemesterDto,
} from '@sigoa/shared';

export const SAMPLE_PROCESS_EXECUTION_DTO: ProcessExecutionDto = {
  id: 'exec-2027-oe',
  type: 'P612',
  name: 'Medición anual de OE 2027',
  year: 2027,
  semesterId: null,
  semesterCode: null,
  catalogVersionId: 'cv-approved-1',
  catalogVersionNumber: 1,
  status: 'PLANNED',
  voidReason: null,
  createdAt: '2027-01-15T10:00:00.000Z',
  updatedAt: '2027-01-15T10:00:00.000Z',
};

export const SAMPLE_SEMESTER_EXECUTION_DTO: ProcessExecutionDto = {
  id: 'exec-2027-ag',
  type: 'P622',
  name: 'Medición directa de AG 2027-I',
  year: 2027,
  semesterId: 'sem-2027-1',
  semesterCode: '2027-I',
  catalogVersionId: 'cv-approved-1',
  catalogVersionNumber: 1,
  status: 'PLANNED',
  voidReason: null,
  createdAt: '2027-02-01T10:00:00.000Z',
  updatedAt: '2027-02-01T10:00:00.000Z',
};

export function makeProcessExecutionsResponse(
  items: ProcessExecutionDto[] = [SAMPLE_PROCESS_EXECUTION_DTO],
  overrides: Partial<ListProcessExecutionsResponse> = {},
): ListProcessExecutionsResponse {
  return {
    items,
    page: 1,
    pageSize: 20,
    total: items.length,
    totalPages: items.length === 0 ? 0 : 1,
    ...overrides,
  };
}

export const SAMPLE_CATALOG_VERSIONS: CatalogVersionDto[] = [
  {
    id: 'cv-approved-1',
    programId: 'prog-1',
    number: 1,
    status: 'APPROVED',
    basedOnVersionId: null,
    objectiveCount: 4,
    attributeCount: 12,
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'cv-validation-2',
    programId: 'prog-1',
    number: 2,
    status: 'IN_VALIDATION',
    basedOnVersionId: 'cv-approved-1',
    objectiveCount: 4,
    attributeCount: 12,
    createdAt: '2026-06-10T00:00:00.000Z',
  },
  {
    id: 'cv-draft-3',
    programId: 'prog-1',
    number: 3,
    status: 'DRAFT',
    basedOnVersionId: 'cv-approved-1',
    objectiveCount: 4,
    attributeCount: 12,
    createdAt: '2026-08-10T00:00:00.000Z',
  },
];

export const SAMPLE_SEMESTERS: SemesterDto[] = [
  {
    id: 'sem-2027-1',
    code: '2027-I',
    startDate: '2027-03-01',
    endDate: '2027-07-15',
    createdAt: '2026-12-01T00:00:00.000Z',
    updatedAt: '2026-12-01T00:00:00.000Z',
  },
  {
    id: 'sem-2027-2',
    code: '2027-II',
    startDate: '2027-08-15',
    endDate: '2027-12-20',
    createdAt: '2026-12-01T00:00:00.000Z',
    updatedAt: '2026-12-01T00:00:00.000Z',
  },
];
