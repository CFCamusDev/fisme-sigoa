import { describe, expect, it } from 'vitest';
import { diffCatalogItems } from './catalog-diff';

const current = [
  { code: 'AG-C01', name: 'Uno', statement: 'Texto uno.' },
  { code: 'AG-C02', name: 'Dos', statement: 'Texto dos.' },
  { code: 'AG-C03', name: 'Tres', statement: 'Texto tres.' },
];

describe('diffCatalogItems (HU-014, D9, CA1)', () => {
  it('marks every item as unchanged when the draft is a copy', () => {
    const { changes, removedCodes } = diffCatalogItems(current, current);

    expect([...changes.values()]).toEqual(['UNCHANGED', 'UNCHANGED', 'UNCHANGED']);
    expect(removedCodes).toEqual([]);
  });

  it('marks an edited statement as modified against the current version', () => {
    const draft = [current[0]!, { ...current[1]!, statement: 'Texto nuevo.' }, current[2]!];

    const { changes } = diffCatalogItems(draft, current);

    expect(changes.get('AG-C02')).toBe('MODIFIED');
    expect(changes.get('AG-C01')).toBe('UNCHANGED');
  });

  it('marks an edited name as modified', () => {
    const draft = [{ ...current[0]!, name: 'Otro nombre' }];

    expect(diffCatalogItems(draft, current).changes.get('AG-C01')).toBe('MODIFIED');
  });

  it('marks a code that is not in the current version as new', () => {
    const draft = [...current, { code: 'AG-C13', name: 'Nuevo', statement: 'Texto.' }];

    expect(diffCatalogItems(draft, current).changes.get('AG-C13')).toBe('NEW');
  });

  it('lists the codes of the current version that are no longer in the draft', () => {
    const { removedCodes } = diffCatalogItems([current[0]!], current);

    expect(removedCodes).toEqual(['AG-C02', 'AG-C03']);
  });

  it('does not count a different order as a modification', () => {
    const { changes } = diffCatalogItems([...current].reverse(), current);

    expect([...changes.values()].every((change) => change === 'UNCHANGED')).toBe(true);
  });

  it('compares objectives without a name', () => {
    const { changes } = diffCatalogItems(
      [
        { code: 'OEP1', statement: 'A' },
        { code: 'OEP2', statement: 'B2' },
      ],
      [
        { code: 'OEP1', statement: 'A' },
        { code: 'OEP2', statement: 'B' },
      ],
    );

    expect(changes.get('OEP1')).toBe('UNCHANGED');
    expect(changes.get('OEP2')).toBe('MODIFIED');
  });

  it('treats every item as new when there is no current version', () => {
    const { changes, removedCodes } = diffCatalogItems(current, []);

    expect([...changes.values()]).toEqual(['NEW', 'NEW', 'NEW']);
    expect(removedCodes).toEqual([]);
  });
});
