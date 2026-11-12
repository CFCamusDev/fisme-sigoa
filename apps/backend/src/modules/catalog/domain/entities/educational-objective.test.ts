import { describe, expect, it } from 'vitest';
import { InvalidCatalogDataError } from '../errors/index.js';
import { EducationalObjective } from './educational-objective.js';

function objective(overrides: Partial<Parameters<typeof EducationalObjective.create>[0]> = {}) {
  return EducationalObjective.create({
    id: 'oe-1',
    versionId: 'v1',
    code: 'OEP1',
    statement: 'Texto del objetivo.',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('EducationalObjective', () => {
  it('trims code and statement', () => {
    const created = objective({ code: ' OEP1 ', statement: '  Texto.  ' });
    expect(created.code).toBe('OEP1');
    expect(created.statement).toBe('Texto.');
  });

  it.each(['', 'oep1', 'O', '1OEP', 'OEP_1', 'A'.repeat(21)])('rejects the code %j', (code) => {
    expect(() => objective({ code })).toThrow(InvalidCatalogDataError);
  });

  it.each(['', '   ', 'x'.repeat(2001)])('rejects a statement of %j length', (statement) => {
    expect(() => objective({ statement })).toThrow(InvalidCatalogDataError);
  });

  it('accepts a statement of exactly 2000 characters', () => {
    expect(objective({ statement: 'x'.repeat(2000) }).statement).toHaveLength(2000);
  });

  it.each([0, -1, 1.5])('rejects the order %s', (order) => {
    expect(() => objective({ order })).toThrow(InvalidCatalogDataError);
  });

  it('copies code, statement and order to another version with a new id', () => {
    const original = objective({ code: 'OEP3', order: 3 });
    const copy = original.copyTo('oe-9', 'v2', 'user-1');
    expect(copy.id).toBe('oe-9');
    expect(copy.versionId).toBe('v2');
    expect(copy.code).toBe('OEP3');
    expect(copy.statement).toBe(original.statement);
    expect(copy.order).toBe(3);
    expect(original.versionId).toBe('v1');
    expect(copy.createdBy).toBe('user-1');
  });
});
