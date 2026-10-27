import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { HealthResponse } from '@sigoa/shared';
import { getHealth } from '../api/get-health';

export const HEALTH_QUERY_KEY = ['health'] as const;

export function useHealth(): UseQueryResult<HealthResponse, Error> {
  return useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: getHealth,
  });
}
