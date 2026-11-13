import { describe, expect, it } from 'vitest';
import { InvalidCatalogDataError, InvalidCatalogTransitionError } from '../errors/index.js';
import { CATALOG_VERSION_STATUSES, CatalogVersion } from './catalog-version.js';

function draft(number = 2) {
  return CatalogVersion.createDraft({ id: 'v2', programId: 'p1', number, basedOnVersionId: 'v1' });
}

describe('CatalogVersion', () => {
  it('is born as a draft linked to its source version', () => {
    const version = draft();
    expect(version.status).toBe('DRAFT');
    expect(version.basedOnVersionId).toBe('v1');
    expect(version.isOpen()).toBe(true);
  });

  it('is born without a source version when none is given', () => {
    const version = CatalogVersion.createDraft({ id: 'v1', programId: 'p1', number: 1 });
    expect(version.basedOnVersionId).toBeNull();
    expect(version.snapshot()).toEqual({
      programId: 'p1',
      number: 1,
      status: 'DRAFT',
      basedOnVersionId: null,
    });
  });

  it('records the actor as creator and updater', () => {
    const version = CatalogVersion.createDraft({
      id: 'v3',
      programId: 'p1',
      number: 3,
      actorId: 'user-1',
    });
    expect(version.createdBy).toBe('user-1');
    expect(version.updatedBy).toBe('user-1');
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects the version number %s', (number) => {
    expect(() => draft(number)).toThrow(InvalidCatalogDataError);
  });

  it('rejects an unknown status when rebuilding a persisted version', () => {
    expect(() =>
      CatalogVersion.create({
        id: 'v1',
        programId: 'p1',
        number: 1,
        status: 'ARCHIVED' as never,
        basedOnVersionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow(InvalidCatalogDataError);
  });

  describe('sendToValidation (HU-015, RF-015, RS-020)', () => {
    const NOW = new Date('2026-11-12T12:00:00.000Z');

    it('sends a draft with objectives and attributes to validation', () => {
      const original = draft();

      const sent = original.sendToValidation({
        objectiveCount: 1,
        attributeCount: 1,
        actorId: 'user-9',
        now: NOW,
      });

      expect(sent.status).toBe('IN_VALIDATION');
      expect(sent.id).toBe('v2');
      expect(sent.basedOnVersionId).toBe('v1');
      expect(sent.updatedBy).toBe('user-9');
      expect(sent.updatedAt).toEqual(NOW);
      expect(sent.isOpen()).toBe(true);
      expect(original.status).toBe('DRAFT');
    });

    it('rejects sending a version without attributes', () => {
      expect(() =>
        draft().sendToValidation({ objectiveCount: 4, attributeCount: 0, actorId: 'user-9' }),
      ).toThrow(/al menos un objetivo educacional y un atributo del graduado/);
    });

    it('rejects sending a version without objectives', () => {
      expect(() =>
        draft().sendToValidation({ objectiveCount: 0, attributeCount: 12, actorId: 'user-9' }),
      ).toThrow(InvalidCatalogTransitionError);
    });

    it.each(['IN_VALIDATION', 'APPROVED', 'HISTORICAL'] as const)(
      'rejects sending a version that is already %s',
      (status) => {
        const version = CatalogVersion.create({
          id: 'v2',
          programId: 'p1',
          number: 2,
          status,
          basedOnVersionId: null,
          createdAt: NOW,
          updatedAt: NOW,
        });
        expect(() =>
          version.sendToValidation({ objectiveCount: 4, attributeCount: 12, actorId: 'user-9' }),
        ).toThrow(InvalidCatalogTransitionError);
      },
    );
  });

  it('counts draft and in validation as open, approved and historical as closed', () => {
    const openByStatus = Object.fromEntries(
      CATALOG_VERSION_STATUSES.map((status) => [
        status,
        CatalogVersion.create({
          id: 'v1',
          programId: 'p1',
          number: 1,
          status,
          basedOnVersionId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).isOpen(),
      ]),
    );
    expect(openByStatus).toEqual({
      DRAFT: true,
      IN_VALIDATION: true,
      APPROVED: false,
      HISTORICAL: false,
    });
  });
});
