export const parameterKeys = {
  all: ['parameters'] as const,
  list: (semesterCode?: string) => ['parameters', semesterCode ?? 'current'] as const,
};
