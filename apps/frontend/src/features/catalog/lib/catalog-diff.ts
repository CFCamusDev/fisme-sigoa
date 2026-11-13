export type CatalogChange = 'NEW' | 'MODIFIED' | 'UNCHANGED';

/** Forma mínima común a OE y AG para comparar el Borrador con la versión vigente. */
export interface CatalogDiffItem {
  readonly code: string;
  readonly statement: string;
  readonly name?: string;
}

export interface CatalogDiffResult {
  /** Cambio de cada código del Borrador respecto de la vigente. */
  readonly changes: ReadonlyMap<string, CatalogChange>;
  /** Códigos de la vigente que ya no están en el Borrador. */
  readonly removedCodes: readonly string[];
}

/**
 * Compara por código el Borrador contra la versión vigente (D9, CA1): Nuevo si el código no
 * existe en la vigente, Modificado si cambió el nombre o el enunciado y Sin cambios en otro caso.
 * Es una función pura; el orden no cuenta como modificación.
 */
export function diffCatalogItems(
  draft: readonly CatalogDiffItem[],
  current: readonly CatalogDiffItem[],
): CatalogDiffResult {
  const currentByCode = new Map(current.map((item) => [item.code, item]));
  const changes = new Map<string, CatalogChange>();

  for (const item of draft) {
    const reference = currentByCode.get(item.code);
    if (!reference) {
      changes.set(item.code, 'NEW');
    } else if (reference.statement !== item.statement || reference.name !== item.name) {
      changes.set(item.code, 'MODIFIED');
    } else {
      changes.set(item.code, 'UNCHANGED');
    }
  }

  const draftCodes = new Set(draft.map((item) => item.code));
  const removedCodes = current.map((item) => item.code).filter((code) => !draftCodes.has(code));

  return { changes, removedCodes };
}
