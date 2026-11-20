import type { ListQualityCommitteesParams } from '../api/list-quality-committees';

export const qualityCommitteeKeys = {
  all: ['quality-committees'] as const,
  current: () => [...qualityCommitteeKeys.all, 'current'] as const,
  list: (params: ListQualityCommitteesParams = {}) =>
    [
      ...qualityCommitteeKeys.all,
      'list',
      { page: params.page ?? 1, pageSize: params.pageSize ?? 10 },
    ] as const,
};
