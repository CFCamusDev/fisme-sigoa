export type ComparisonChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';

export interface ComparisonItemWithChange {
  readonly change: ComparisonChangeType | string;
}

/** Cuenta solo los cambios reales (ADDED, REMOVED, MODIFIED), excluyendo UNCHANGED. */
export function countComparisonChanges(items: readonly ComparisonItemWithChange[]): number {
  let count = 0;
  for (const item of items) {
    if (item.change === 'ADDED' || item.change === 'REMOVED' || item.change === 'MODIFIED') {
      count += 1;
    }
  }
  return count;
}
