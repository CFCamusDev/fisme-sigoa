import {
  templateDetailDtoSchema,
  templateSummaryDtoSchema,
  templateVersionDtoSchema,
  templateVersionSummaryDtoSchema,
  type TemplateDetailDto,
  type TemplateSummaryDto,
  type TemplateVersionDto,
  type TemplateVersionSummaryDto,
} from '@sigoa/shared';
import type { Template } from '../domain/entities/template.js';
import type { TemplateVersion } from '../domain/entities/template-version.js';

/** Los DTO se parsean con el esquema compartido antes de salir (nulabilidad igual a la base). */
export function toTemplateVersionSummaryDto(version: TemplateVersion): TemplateVersionSummaryDto {
  return templateVersionSummaryDtoSchema.parse({
    id: version.id,
    number: version.number,
    status: version.status,
    publishedAt: version.publishedAt ? version.publishedAt.toISOString() : null,
    updatedAt: version.updatedAt.toISOString(),
  });
}

export function toTemplateVersionDto(version: TemplateVersion): TemplateVersionDto {
  return templateVersionDtoSchema.parse({
    ...toTemplateVersionSummaryDto(version),
    content: version.content,
  });
}

export function toTemplateSummaryDto(
  template: Template,
  published: TemplateVersion | null,
  draft: TemplateVersion | null,
): TemplateSummaryDto {
  return templateSummaryDtoSchema.parse({
    id: template.id,
    code: template.code,
    name: template.name,
    type: template.type,
    variables: template.variables,
    published: published ? toTemplateVersionSummaryDto(published) : null,
    draft: draft ? toTemplateVersionSummaryDto(draft) : null,
  });
}

export function toTemplateDetailDto(
  template: Template,
  versions: readonly TemplateVersion[],
): TemplateDetailDto {
  const ordered = [...versions].sort((a, b) => b.number - a.number);
  const published = ordered.find((version) => version.status === 'PUBLISHED') ?? null;
  const draft = ordered.find((version) => version.status === 'DRAFT') ?? null;
  return templateDetailDtoSchema.parse({
    id: template.id,
    code: template.code,
    name: template.name,
    type: template.type,
    variables: template.variables,
    versions: ordered.map(toTemplateVersionSummaryDto),
    published: published ? toTemplateVersionDto(published) : null,
    draft: draft ? toTemplateVersionDto(draft) : null,
  });
}
