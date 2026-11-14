import type { GetTemplatesParams } from '../api/get-templates';

export const templateKeys = {
  all: ['templates'] as const,
  list: (params: GetTemplatesParams = {}) => ['templates', 'list', params] as const,
  detail: (templateId: string) => ['templates', 'detail', templateId] as const,
};
