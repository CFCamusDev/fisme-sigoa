export const catalogKeys = {
  all: ['catalog-versions'] as const,
  list: () => ['catalog-versions', 'list'] as const,
  detail: (versionId: string) => ['catalog-versions', 'detail', versionId] as const,
};
