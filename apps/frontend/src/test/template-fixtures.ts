import type {
  ListTemplatesResponse,
  TemplateDetailDto,
  TemplateSummaryDto,
  TemplateVersionDto,
  TemplateVersionSummaryDto,
} from '@sigoa/shared';

export const PUBLISHED_AT = '2026-11-01T10:00:00.000Z';
export const DRAFT_UPDATED_AT = '2026-11-05T10:00:00.000Z';

export function buildPublishedVersionSummary(
  overrides: Partial<TemplateVersionSummaryDto> = {},
): TemplateVersionSummaryDto {
  return {
    id: 'ver-1',
    number: 1,
    status: 'PUBLISHED',
    publishedAt: PUBLISHED_AT,
    updatedAt: PUBLISHED_AT,
    ...overrides,
  };
}

export function buildDraftVersionSummary(
  overrides: Partial<TemplateVersionSummaryDto> = {},
): TemplateVersionSummaryDto {
  return {
    id: 'ver-2',
    number: 2,
    status: 'DRAFT',
    publishedAt: null,
    updatedAt: DRAFT_UPDATED_AT,
    ...overrides,
  };
}

export function buildTemplateVersion(
  overrides: Partial<TemplateVersionDto> = {},
): TemplateVersionDto {
  return {
    ...buildDraftVersionSummary(),
    content: '<p>{{program.name}} borrador</p>',
    ...overrides,
  };
}

export function buildTemplateSummary(
  overrides: Partial<TemplateSummaryDto> = {},
): TemplateSummaryDto {
  return {
    id: 'tpl-1',
    code: 'FO-01',
    name: 'Anexo 1. Cronograma',
    type: 'ANNEX',
    variables: [
      { key: 'program.name', label: 'Nombre del programa' },
      { key: 'schedule.period', label: 'Periodo del cronograma' },
    ],
    published: buildPublishedVersionSummary(),
    draft: null,
    ...overrides,
  };
}

export function buildTemplatesResponse(
  items: TemplateSummaryDto[] = [],
  overrides: Partial<ListTemplatesResponse> = {},
): ListTemplatesResponse {
  return {
    items,
    page: 1,
    pageSize: 50,
    total: items.length,
    totalPages: items.length === 0 ? 0 : 1,
    ...overrides,
  };
}

/** Plantilla con la versión 1 Publicada y, si `withDraft`, un Borrador (versión 2). */
export function buildTemplateDetail(
  overrides: Partial<TemplateDetailDto> & { withDraft?: boolean } = {},
): TemplateDetailDto {
  const { withDraft = false, ...rest } = overrides;
  const draft = withDraft ? buildTemplateVersion() : null;
  return {
    id: 'tpl-1',
    code: 'FO-01',
    name: 'Anexo 1. Cronograma',
    type: 'ANNEX',
    variables: [
      { key: 'program.name', label: 'Nombre del programa' },
      { key: 'schedule.period', label: 'Periodo del cronograma' },
    ],
    versions: [...(draft ? [buildDraftVersionSummary()] : []), buildPublishedVersionSummary()],
    published: { ...buildPublishedVersionSummary(), content: '<p>{{program.name}} versión 1</p>' },
    draft,
    ...rest,
  };
}
