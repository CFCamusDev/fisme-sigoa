import { describe, expect, it } from 'vitest';
import { InvalidCatalogDataError } from '../errors/index.js';
import { GraduateAttribute } from './graduate-attribute.js';

function attribute(overrides: Partial<Parameters<typeof GraduateAttribute.create>[0]> = {}) {
  return GraduateAttribute.create({
    id: 'ag-1',
    versionId: 'v1',
    code: 'AG-C01',
    name: 'Conocimientos de ingeniería',
    statement: 'Texto del atributo.',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('GraduateAttribute', () => {
  it('trims code, name and statement', () => {
    const created = attribute({ code: ' AG-C01 ', name: ' Nombre ', statement: ' Texto ' });
    expect(created.code).toBe('AG-C01');
    expect(created.name).toBe('Nombre');
    expect(created.statement).toBe('Texto');
  });

  it.each(['', 'ag-c01', 'A', '1AG', 'AG C01', 'A'.repeat(21)])('rejects the code %j', (code) => {
    expect(() => attribute({ code })).toThrow(InvalidCatalogDataError);
  });

  it.each(['', '   ', 'n'.repeat(121)])('rejects a name of %j length', (name) => {
    expect(() => attribute({ name })).toThrow(InvalidCatalogDataError);
  });

  it.each(['', '   ', 'x'.repeat(2001)])('rejects a statement of %j length', (statement) => {
    expect(() => attribute({ statement })).toThrow(InvalidCatalogDataError);
  });

  it.each([0, -3, 2.5])('rejects the order %s', (order) => {
    expect(() => attribute({ order })).toThrow(InvalidCatalogDataError);
  });

  it('copies code, name, statement and order to another version with a new id', () => {
    const original = attribute({ code: 'AG-C12', order: 12 });
    const copy = original.copyTo('ag-9', 'v2');
    expect(copy.id).toBe('ag-9');
    expect(copy.versionId).toBe('v2');
    expect(copy.code).toBe('AG-C12');
    expect(copy.name).toBe(original.name);
    expect(copy.statement).toBe(original.statement);
    expect(copy.order).toBe(12);
    expect(original.versionId).toBe('v1');
  });
});
