import { describe, expect, it } from 'vitest';
import { InvalidCatalogDataError } from '../errors/index.js';
import { EducationalObjective } from './educational-objective.js';

const now = new Date('2026-11-12T10:00:00.000Z');

function objective() {
  return EducationalObjective.create({
    id: 'oe-1',
    versionId: 'v1',
    code: 'OEP1',
    statement: 'Texto del objetivo.',
    order: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('EducationalObjective editing (T-014-11, HU-014)', () => {
  it('creates a new objective stamped with the actor', () => {
    const created = EducationalObjective.createNew({
      id: 'oe-9',
      versionId: 'v2',
      code: 'OEP9',
      statement: 'Nuevo.',
      order: 5,
      actorId: 'user-1',
      now,
    });
    expect(created).toMatchObject({ id: 'oe-9', versionId: 'v2', order: 5, createdBy: 'user-1' });
    expect(created.updatedAt).toBe(now);
  });

  it('edits code and statement keeping id, version and order, without mutating the original', () => {
    const original = objective();
    const edited = original.edit({ code: 'OEP7', statement: ' Otro. ', actorId: 'user-2', now });
    expect(edited).toMatchObject({
      id: 'oe-1',
      versionId: 'v1',
      code: 'OEP7',
      statement: 'Otro.',
      order: 1,
      updatedBy: 'user-2',
    });
    expect(edited.updatedAt).toBe(now);
    expect(original.code).toBe('OEP1');
  });

  it('rejects an edit with an invalid code', () => {
    expect(() =>
      objective().edit({ code: 'bad code', statement: 'Texto.', actorId: 'u', now }),
    ).toThrow(InvalidCatalogDataError);
  });

  it('changes only the order with withOrder', () => {
    const moved = objective().withOrder(3, 'user-2', now);
    expect(moved).toMatchObject({ code: 'OEP1', order: 3, updatedBy: 'user-2' });
  });

  it('detects an edit without changes', () => {
    const original = objective();
    expect(original.hasSameContent({ code: ' OEP1 ', statement: 'Texto del objetivo.' })).toBe(
      true,
    );
    expect(original.hasSameContent({ code: 'OEP1', statement: 'Otro texto.' })).toBe(false);
  });
});
