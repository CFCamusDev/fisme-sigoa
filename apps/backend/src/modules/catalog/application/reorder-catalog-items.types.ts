export type CatalogItemKind = 'OBJECTIVES' | 'ATTRIBUTES';

export interface ReorderCatalogItemsCommand<K extends CatalogItemKind = CatalogItemKind> {
  readonly actorId: string;
  readonly ip?: string;
  readonly versionId: string;
  readonly kind: K;
  /** Lista completa de ids en el orden nuevo. */
  readonly orderedIds: readonly string[];
}
