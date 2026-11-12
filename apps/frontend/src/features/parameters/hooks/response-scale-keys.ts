export const responseScaleKeys = {
  all: ['response-scales'] as const,
  list: (type?: string) => ['response-scales', type ?? 'all'] as const,
};
