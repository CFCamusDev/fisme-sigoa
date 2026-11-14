import type { ListResolutionsResponse, ResolutionDto } from '@sigoa/shared';

export function buildResolution(overrides: Partial<ResolutionDto> = {}): ResolutionDto {
  return {
    id: 'res-1',
    type: 'EDUCATIONAL_OBJECTIVE',
    number: 'RD-012/2027-FISME',
    issuedOn: '2026-11-10',
    status: 'REGISTERED',
    catalogVersionId: 'cv-2',
    pdfFileId: null,
    approvedAt: null,
    approvedBy: null,
    createdAt: '2026-11-13T15:00:00.000Z',
    updatedAt: '2026-11-13T15:00:00.000Z',
    ...overrides,
  };
}

export function buildApprovedResolution(overrides: Partial<ResolutionDto> = {}): ResolutionDto {
  return buildResolution({
    status: 'APPROVED',
    pdfFileId: 'file-1',
    approvedAt: '2026-11-14T09:00:00.000Z',
    approvedBy: 'user-2',
    updatedAt: '2026-11-14T09:00:00.000Z',
    ...overrides,
  });
}

export function buildResolutionsResponse(
  items: ResolutionDto[] = [],
  overrides: Partial<ListResolutionsResponse> = {},
): ListResolutionsResponse {
  return {
    items,
    page: 1,
    pageSize: 20,
    total: items.length,
    totalPages: items.length === 0 ? 0 : 1,
    ...overrides,
  };
}
