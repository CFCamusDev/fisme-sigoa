export const scheduleKeys = {
  all: ['schedule'] as const,
  detail: (executionId: string) => ['schedule', executionId] as const,
};
