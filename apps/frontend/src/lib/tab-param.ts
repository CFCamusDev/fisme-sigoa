import { z } from 'zod';

export const tabSearchSchema = z.object({
  tab: z.string().max(32).optional().catch(undefined),
});

export function parseTabParam<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof value !== 'string') {
    return fallback;
  }
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
