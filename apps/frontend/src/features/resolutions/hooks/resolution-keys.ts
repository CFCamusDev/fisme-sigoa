import type { GetResolutionsParams } from '../api/get-resolutions';

export const resolutionKeys = {
  all: ['resolutions'] as const,
  list: (params: GetResolutionsParams = {}) => ['resolutions', 'list', params] as const,
};
