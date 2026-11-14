import { describe, expect, it } from 'vitest';
import { diffWords, type WordDiffSegment } from './word-diff.js';

function joinKept(segments: readonly WordDiffSegment[]): string {
  return segments
    .filter((segment) => segment.type !== 'REMOVED')
    .map((segment) => segment.text)
    .join('');
}

describe('diffWords (HU-017, D2)', () => {
  it('returns a single EQUAL segment for identical texts', () => {
    expect(diffWords('Formar ingenieros.', 'Formar ingenieros.')).toEqual([
      { type: 'EQUAL', text: 'Formar ingenieros.' },
    ]);
  });

  it('returns no segments when both texts are empty', () => {
    expect(diffWords('', '')).toEqual([]);
  });

  it('marks an added word', () => {
    const segments = diffWords('Formar ingenieros.', 'Formar buenos ingenieros.');

    expect(segments).toEqual([
      { type: 'EQUAL', text: 'Formar ' },
      { type: 'ADDED', text: 'buenos ' },
      { type: 'EQUAL', text: 'ingenieros.' },
    ]);
  });

  it('marks a removed word', () => {
    const segments = diffWords('Formar buenos ingenieros.', 'Formar ingenieros.');

    expect(segments).toEqual([
      { type: 'EQUAL', text: 'Formar ' },
      { type: 'REMOVED', text: 'buenos ' },
      { type: 'EQUAL', text: 'ingenieros.' },
    ]);
  });

  it('shows a replaced word as removed followed by added', () => {
    const segments = diffWords('Formar ingenieros éticos.', 'Formar ingenieros líderes.');

    expect(segments).toEqual([
      { type: 'EQUAL', text: 'Formar ingenieros ' },
      { type: 'REMOVED', text: 'éticos.' },
      { type: 'ADDED', text: 'líderes.' },
    ]);
  });

  it('treats everything as added when the base is empty and as removed when the target is empty', () => {
    expect(diffWords('', 'Texto nuevo')).toEqual([{ type: 'ADDED', text: 'Texto nuevo' }]);
    expect(diffWords('Texto viejo', '')).toEqual([{ type: 'REMOVED', text: 'Texto viejo' }]);
  });

  it('ignores differences in spacing between words and keeps accents intact', () => {
    const segments = diffWords('Gestión  de   proyectos', 'Gestión de proyectos');

    expect(segments.every((segment) => segment.type === 'EQUAL')).toBe(true);
    expect(joinKept(segments)).toBe('Gestión de proyectos');
  });

  it('rebuilds the target text from the kept segments', () => {
    const before = 'El egresado diseña soluciones de software con criterios de calidad.';
    const after = 'El graduado diseña y evalúa soluciones de software con criterios éticos.';

    expect(joinKept(diffWords(before, after))).toBe(after);
  });

  it('merges adjacent segments of the same type', () => {
    const segments = diffWords('uno dos tres', 'uno cuatro cinco tres');

    expect(segments).toEqual([
      { type: 'EQUAL', text: 'uno ' },
      { type: 'REMOVED', text: 'dos ' },
      { type: 'ADDED', text: 'cuatro cinco ' },
      { type: 'EQUAL', text: 'tres' },
    ]);
  });

  it('computes the worst case of 2000 characters in under 500 ms', () => {
    const words = (prefix: string) =>
      Array.from({ length: 400 }, (_, index) => `${prefix}${index % 7}`)
        .join(' ')
        .slice(0, 2000);
    const before = words('a');
    const after = words('b');

    const startedAt = performance.now();
    const segments = diffWords(before, after);
    const elapsed = performance.now() - startedAt;

    expect(elapsed).toBeLessThan(500);
    expect(joinKept(segments)).toBe(after);
  }, 5_000);
});
