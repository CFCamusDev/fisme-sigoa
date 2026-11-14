import { describe, expect, it } from 'vitest';
import { Template } from '../domain/entities/template.js';
import { TemplateVersion } from '../domain/entities/template-version.js';
import { toTemplateDetailDto, toTemplateSummaryDto } from './template-dto.js';

const T0 = new Date('2026-11-01T10:00:00.000Z');
const T1 = new Date('2026-11-02T10:00:00.000Z');

const template = Template.create({
  id: 't1',
  code: 'FO-01',
  name: 'Anexo 1',
  type: 'ANNEX',
  variables: [{ key: 'programName', label: 'Programa' }],
});

function version(id: string, number: number, content: string): TemplateVersion {
  return TemplateVersion.createDraft({ id, templateId: 't1', number, content, now: T0 });
}

describe('template DTO mappers', () => {
  it('maps a template without versions with null published and draft', () => {
    const dto = toTemplateSummaryDto(template, null, null);
    expect(dto).toEqual({
      id: 't1',
      code: 'FO-01',
      name: 'Anexo 1',
      type: 'ANNEX',
      variables: [{ key: 'programName', label: 'Programa' }],
      published: null,
      draft: null,
    });
  });

  it('maps ISO dates and a null publishedAt for the draft', () => {
    const published = version('v1', 1, '<p>1</p>').publish({ actorId: 'u', now: T1 });
    const draft = version('v2', 2, '<p>2</p>');
    const dto = toTemplateSummaryDto(template, published, draft);
    expect(dto.published).toEqual({
      id: 'v1',
      number: 1,
      status: 'PUBLISHED',
      publishedAt: T1.toISOString(),
      updatedAt: T1.toISOString(),
    });
    expect(dto.draft?.publishedAt).toBeNull();
  });

  it('builds the detail with history in descending order and the contents of current versions', () => {
    const obsolete = version('v1', 1, '<p>1</p>')
      .publish({ actorId: 'u', now: T1 })
      .markObsolete({ actorId: 'u', now: T1 });
    const published = version('v2', 2, '<p>2</p>').publish({ actorId: 'u', now: T1 });
    const draft = version('v3', 3, '<p>3</p>');
    const dto = toTemplateDetailDto(template, [obsolete, draft, published]);
    expect(dto.versions.map((item) => item.number)).toEqual([3, 2, 1]);
    expect(dto.published?.content).toBe('<p>2</p>');
    expect(dto.draft?.content).toBe('<p>3</p>');
  });

  it('builds the detail of a template with only obsolete history', () => {
    const obsolete = version('v1', 1, '<p>1</p>')
      .publish({ actorId: 'u', now: T1 })
      .markObsolete({ actorId: 'u', now: T1 });
    const dto = toTemplateDetailDto(template, [obsolete]);
    expect(dto.published).toBeNull();
    expect(dto.draft).toBeNull();
    expect(dto.versions).toHaveLength(1);
  });
});
