import { describe, expect, it } from 'vitest';
import {
  compareCatalogItems,
  summarizeCatalogComparison,
  type CatalogComparableItem,
} from './catalog-comparison.js';

const oe = (code: string, statement: string): CatalogComparableItem => ({ code, statement });
const ag = (code: string, name: string, statement: string): CatalogComparableItem => ({
  code,
  name,
  statement,
});

describe('compareCatalogItems (HU-017, CA1)', () => {
  it('marks added, removed and modified items with word-level segments', () => {
    const base = [
      oe('OEP1', 'Formar ingenieros éticos.'),
      oe('OEP2', 'Promover la investigación.'),
      oe('OEP3', 'Texto sin cambios.'),
    ];
    const target = [
      oe('OEP1', 'Formar ingenieros líderes.'),
      oe('OEP3', 'Texto sin cambios.'),
      oe('OEP4', 'Fomentar el emprendimiento.'),
    ];

    const diffs = compareCatalogItems(base, target);

    expect(diffs.map((diff) => [diff.code, diff.change])).toEqual([
      ['OEP1', 'MODIFIED'],
      ['OEP3', 'UNCHANGED'],
      ['OEP4', 'ADDED'],
      ['OEP2', 'REMOVED'],
    ]);
    expect(diffs[0]?.statementSegments).toEqual([
      { type: 'EQUAL', text: 'Formar ingenieros ' },
      { type: 'REMOVED', text: 'éticos.' },
      { type: 'ADDED', text: 'líderes.' },
    ]);
    expect(diffs[1]?.statementSegments).toEqual([{ type: 'EQUAL', text: 'Texto sin cambios.' }]);
    expect(diffs[2]).toMatchObject({
      base: null,
      target: { statement: 'Fomentar el emprendimiento.' },
      statementSegments: [{ type: 'ADDED', text: 'Fomentar el emprendimiento.' }],
    });
    expect(diffs[3]).toMatchObject({
      target: null,
      base: { statement: 'Promover la investigación.' },
      statementSegments: [{ type: 'REMOVED', text: 'Promover la investigación.' }],
    });
  });

  it('follows the target order and puts removed items last in the base order', () => {
    const base = [oe('B', 'b'), oe('A', 'a'), oe('C', 'c')];
    const target = [oe('C', 'c'), oe('D', 'd')];

    expect(compareCatalogItems(base, target).map((diff) => diff.code)).toEqual([
      'C',
      'D',
      'B',
      'A',
    ]);
  });

  it('compares the name and the statement of graduate attributes', () => {
    const diffs = compareCatalogItems(
      [ag('AG-C01', 'Conocimiento de ingeniería', 'Aplica matemáticas.')],
      [ag('AG-C01', 'Conocimiento de la ingeniería', 'Aplica matemáticas.')],
    );

    expect(diffs[0]?.change).toBe('MODIFIED');
    expect(diffs[0]?.nameSegments).toEqual([
      { type: 'EQUAL', text: 'Conocimiento de ' },
      { type: 'ADDED', text: 'la ' },
      { type: 'EQUAL', text: 'ingeniería' },
    ]);
    expect(diffs[0]?.statementSegments).toEqual([{ type: 'EQUAL', text: 'Aplica matemáticas.' }]);
  });

  it('has no name segments for objectives', () => {
    const [diff] = compareCatalogItems([oe('OEP1', 'a')], [oe('OEP1', 'b')]);

    expect(diff?.nameSegments).toEqual([]);
    expect(diff?.base).toEqual({ statement: 'a' });
  });

  it('handles empty versions on either side', () => {
    expect(compareCatalogItems([], [])).toEqual([]);
    expect(compareCatalogItems([], [oe('OEP1', 'a')]).map((diff) => diff.change)).toEqual([
      'ADDED',
    ]);
    expect(compareCatalogItems([oe('OEP1', 'a')], []).map((diff) => diff.change)).toEqual([
      'REMOVED',
    ]);
  });
});

describe('summarizeCatalogComparison', () => {
  it('counts each kind of change across objectives and attributes', () => {
    const objectives = compareCatalogItems(
      [oe('OEP1', 'a'), oe('OEP2', 'b')],
      [oe('OEP1', 'a2'), oe('OEP3', 'c')],
    );
    const attributes = compareCatalogItems([ag('AG-C01', 'n', 's')], [ag('AG-C01', 'n', 's')]);

    expect(summarizeCatalogComparison(objectives, attributes)).toEqual({
      added: 1,
      removed: 1,
      modified: 1,
      unchanged: 1,
    });
  });
});
