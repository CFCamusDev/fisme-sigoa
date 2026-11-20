import type { AnnexCode } from '@sigoa/shared';

export const annexKeys = {
  all: ['annexes'] as const,
  download: (code: AnnexCode) => ['annexes', 'download', code] as const,
};
