import { describe, expect, it } from 'vitest';
import { InvalidCatalogDataError } from '../errors/index.js';
import { GraduateAttribute } from './graduate-attribute.js';

const now = new Date('2026-11-12T10:00:00.000Z');

function attribute() {
  return GraduateAttribute.create({
    id: 'ag-1',
    versionId: 'v1',
    code: 'AG-C01',
    name: 'Conocimientos',
    statement: 'Texto del atributo.',
    order: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('GraduateAttribute editing (T-014-11, HU-014)', () => {
  it('creates a new attribute stamped with the actor', () => {
    const created = GraduateAttribute.createNew({
      id: 'ag-9',
      versionId: 'v2',
      code: 'AG-C13',
      name: 'Nuevo',
      statement: 'Texto.',
      order: 13,
      actorId: 'user-1',
      now,
    });
    expect(created).toMatchObject({ id: 'ag-9', name: 'Nuevo', order: 13, createdBy: 'user-1' });
  });

  it('edits the statement keeping code and order, without mutating the original', () => {
    const original = attribute();
    const edited = original.edit({
      code: 'AG-C01',
      name: 'Conocimientos',
      statement: 'Enunciado nuevo.',
      actorId: 'user-2',
      now,
    });
    expect(edited).toMatchObject({
      code: 'AG-C01',
      order: 1,
      statement: 'Enunciado nuevo.',
      updatedBy: 'user-2',
    });
    expect(original.statement).toBe('Texto del atributo.');
  });

  it('rejects an edit with an empty name', () => {
    expect(() =>
      attribute().edit({ code: 'AG-C01', name: '  ', statement: 'Texto.', actorId: 'u', now }),
    ).toThrow(InvalidCatalogDataError);
  });

  it('changes only the order with withOrder', () => {
    expect(attribute().withOrder(4, 'user-2', now)).toMatchObject({ code: 'AG-C01', order: 4 });
  });

  it('detects an edit without changes', () => {
    const original = attribute();
    expect(
      original.hasSameContent({
        code: 'AG-C01',
        name: 'Conocimientos',
        statement: 'Texto del atributo.',
      }),
    ).toBe(true);
    expect(
      original.hasSameContent({ code: 'AG-C01', name: 'Otro', statement: 'Texto del atributo.' }),
    ).toBe(false);
  });
});
