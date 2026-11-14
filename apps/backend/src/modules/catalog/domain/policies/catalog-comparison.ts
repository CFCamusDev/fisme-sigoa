import { diffWords, type WordDiffSegment } from './word-diff.js';

export type CatalogItemChange = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';

/** Un OE (sin `name`) o un AG (con `name`) tal como se compara entre dos versiones. */
export interface CatalogComparableItem {
  readonly code: string;
  readonly name?: string;
  readonly statement: string;
}

export interface CatalogItemSide {
  readonly name?: string;
  readonly statement: string;
}

export interface CatalogItemDiff {
  readonly code: string;
  readonly change: CatalogItemChange;
  readonly base: CatalogItemSide | null;
  readonly target: CatalogItemSide | null;
  readonly nameSegments: readonly WordDiffSegment[];
  readonly statementSegments: readonly WordDiffSegment[];
}

export interface CatalogComparisonSummary {
  readonly added: number;
  readonly removed: number;
  readonly modified: number;
  readonly unchanged: number;
}

function sideOf(item: CatalogComparableItem): CatalogItemSide {
  return item.name === undefined
    ? { statement: item.statement }
    : { name: item.name, statement: item.statement };
}

function wholeSegment(type: 'ADDED' | 'REMOVED', text: string | undefined): WordDiffSegment[] {
  return text === undefined || text === '' ? [] : [{ type, text }];
}

/**
 * Compara dos listas de elementos del catálogo por `code` (RF-017). El resultado sigue el orden
 * del destino; los elementos que solo existen en la base van al final, en el orden de la base.
 */
export function compareCatalogItems(
  base: readonly CatalogComparableItem[],
  target: readonly CatalogComparableItem[],
): CatalogItemDiff[] {
  const baseByCode = new Map(base.map((item) => [item.code, item]));
  const targetCodes = new Set(target.map((item) => item.code));
  const diffs: CatalogItemDiff[] = [];

  for (const item of target) {
    const before = baseByCode.get(item.code);
    if (!before) {
      diffs.push({
        code: item.code,
        change: 'ADDED',
        base: null,
        target: sideOf(item),
        nameSegments: wholeSegment('ADDED', item.name),
        statementSegments: wholeSegment('ADDED', item.statement),
      });
      continue;
    }

    const nameSegments =
      before.name === undefined && item.name === undefined
        ? []
        : diffWords(before.name ?? '', item.name ?? '');
    const statementSegments = diffWords(before.statement, item.statement);
    const modified = before.name !== item.name || before.statement !== item.statement;
    diffs.push({
      code: item.code,
      change: modified ? 'MODIFIED' : 'UNCHANGED',
      base: sideOf(before),
      target: sideOf(item),
      nameSegments,
      statementSegments,
    });
  }

  for (const item of base) {
    if (targetCodes.has(item.code)) {
      continue;
    }
    diffs.push({
      code: item.code,
      change: 'REMOVED',
      base: sideOf(item),
      target: null,
      nameSegments: wholeSegment('REMOVED', item.name),
      statementSegments: wholeSegment('REMOVED', item.statement),
    });
  }

  return diffs;
}

/** Conteo de cambios de uno o varios resultados de `compareCatalogItems`. */
export function summarizeCatalogComparison(
  ...groups: readonly (readonly CatalogItemDiff[])[]
): CatalogComparisonSummary {
  const summary = { added: 0, removed: 0, modified: 0, unchanged: 0 };
  for (const diff of groups.flat()) {
    if (diff.change === 'ADDED') {
      summary.added += 1;
    } else if (diff.change === 'REMOVED') {
      summary.removed += 1;
    } else if (diff.change === 'MODIFIED') {
      summary.modified += 1;
    } else {
      summary.unchanged += 1;
    }
  }
  return summary;
}
