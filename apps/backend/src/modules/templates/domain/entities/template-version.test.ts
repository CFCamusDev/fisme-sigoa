import { describe, expect, it } from 'vitest';
import {
  InvalidTemplateDataError,
  InvalidTemplateTransitionError,
  TemplateVersionNotEditableError,
} from '../errors/index.js';
import { TEMPLATE_CONTENT_MAX_LENGTH } from './template-limits.js';
import { TemplateVersion } from './template-version.js';

const T0 = new Date('2026-11-01T10:00:00.000Z');
const T1 = new Date('2026-11-02T10:00:00.000Z');
const T2 = new Date('2026-11-03T10:00:00.000Z');

function draft(content = '<p>{{programName}}</p>', number = 1): TemplateVersion {
  return TemplateVersion.createDraft({
    id: 'ver-1',
    templateId: 'tpl-1',
    number,
    content,
    actorId: 'user-1',
    now: T0,
  });
}

describe('TemplateVersion', () => {
  describe('createDraft', () => {
    it('is born as DRAFT without publication data', () => {
      const version = draft();
      expect(version.status).toBe('DRAFT');
      expect(version.publishedAt).toBeNull();
      expect(version.publishedBy).toBeNull();
      expect(version.createdBy).toBe('user-1');
      expect(version.updatedAt).toEqual(T0);
    });

    it('rejects blank content', () => {
      expect(() => draft('   \n ')).toThrow(InvalidTemplateDataError);
      expect(() => draft('')).toThrow(InvalidTemplateDataError);
    });

    it('accepts content of exactly the limit and rejects one more character', () => {
      expect(() => draft('a'.repeat(TEMPLATE_CONTENT_MAX_LENGTH))).not.toThrow();
      expect(() => draft('a'.repeat(TEMPLATE_CONTENT_MAX_LENGTH + 1))).toThrow(
        InvalidTemplateDataError,
      );
    });

    it.each([0, -1, 1.5, Number.NaN])('rejects the invalid number %s', (number) => {
      expect(() => draft('<p>x</p>', number)).toThrow(InvalidTemplateDataError);
    });
  });

  describe('create (rehydration)', () => {
    const base = {
      id: 'ver-1',
      templateId: 'tpl-1',
      number: 1,
      content: '<p>x</p>',
      publishedBy: null,
      createdAt: T0,
      updatedAt: T0,
    } as const;

    it('rejects a draft with a publication date', () => {
      expect(() => TemplateVersion.create({ ...base, status: 'DRAFT', publishedAt: T1 })).toThrow(
        InvalidTemplateDataError,
      );
    });

    it.each(['PUBLISHED', 'OBSOLETE'] as const)(
      'rejects %s without a publication date',
      (status) => {
        expect(() => TemplateVersion.create({ ...base, status, publishedAt: null })).toThrow(
          InvalidTemplateDataError,
        );
      },
    );

    it('rejects an unknown status', () => {
      expect(() =>
        TemplateVersion.create({
          ...base,
          status: 'ARCHIVED' as never,
          publishedAt: null,
        }),
      ).toThrow(InvalidTemplateDataError);
    });
  });

  describe('withContent', () => {
    it('changes the content of a draft and keeps the original untouched', () => {
      const original = draft();
      const edited = original.withContent('<p>nuevo</p>', 'user-2', T1);
      expect(edited.content).toBe('<p>nuevo</p>');
      expect(edited.updatedBy).toBe('user-2');
      expect(edited.updatedAt).toEqual(T1);
      expect(original.content).toBe('<p>{{programName}}</p>');
    });

    it('rejects invalid new content', () => {
      expect(() => draft().withContent(' ', 'user-2', T1)).toThrow(InvalidTemplateDataError);
    });

    it('does not edit a published version', () => {
      const published = draft().publish({ actorId: 'user-1', now: T1 });
      expect(() => published.withContent('<p>otro</p>', 'user-1', T2)).toThrow(
        TemplateVersionNotEditableError,
      );
    });

    it('does not edit an obsolete version', () => {
      const obsolete = draft()
        .publish({ actorId: 'user-1', now: T1 })
        .markObsolete({ actorId: 'user-1', now: T2 });
      expect(() => obsolete.withContent('<p>otro</p>', 'user-1', T2)).toThrow(
        TemplateVersionNotEditableError,
      );
    });
  });

  describe('publish', () => {
    it('moves a draft to PUBLISHED and records who and when', () => {
      const original = draft();
      const published = original.publish({ actorId: 'user-2', now: T1 });
      expect(published.status).toBe('PUBLISHED');
      expect(published.publishedAt).toEqual(T1);
      expect(published.publishedBy).toBe('user-2');
      expect(published.content).toBe(original.content);
      expect(original.status).toBe('DRAFT');
    });

    it('rejects publishing a version that is not a draft', () => {
      const published = draft().publish({ actorId: 'user-1', now: T1 });
      expect(() => published.publish({ actorId: 'user-1', now: T2 })).toThrow(
        InvalidTemplateTransitionError,
      );
    });
  });

  describe('markObsolete', () => {
    it('moves a published version to OBSOLETE and keeps its content and publication data', () => {
      const published = draft().publish({ actorId: 'user-1', now: T1 });
      const obsolete = published.markObsolete({ actorId: 'user-2', now: T2 });
      expect(obsolete.status).toBe('OBSOLETE');
      expect(obsolete.content).toBe(published.content);
      expect(obsolete.publishedAt).toEqual(T1);
      expect(obsolete.publishedBy).toBe('user-1');
      expect(obsolete.updatedBy).toBe('user-2');
    });

    it('rejects obsoleting a draft', () => {
      expect(() => draft().markObsolete({ actorId: 'user-1', now: T1 })).toThrow(
        InvalidTemplateTransitionError,
      );
    });

    it('rejects obsoleting an already obsolete version', () => {
      const obsolete = draft()
        .publish({ actorId: 'user-1', now: T1 })
        .markObsolete({ actorId: 'user-1', now: T2 });
      expect(() => obsolete.markObsolete({ actorId: 'user-1', now: T2 })).toThrow(
        InvalidTemplateTransitionError,
      );
    });
  });

  it('exposes a snapshot for the audit trail', () => {
    expect(draft().snapshot()).toEqual({ templateId: 'tpl-1', number: 1, status: 'DRAFT' });
  });
});
