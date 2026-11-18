import { useMemo } from 'react';
import type { ProcessExecutionDto } from '@sigoa/shared';
import { useProcessExecutions } from '@/features/processes';

export interface LinkableProcessExecutionsResult {
  readonly items: readonly ProcessExecutionDto[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly refetch: () => void;
}

export function useLinkableProcessExecutions(): LinkableProcessExecutionsResult {
  const plannedQuery = useProcessExecutions({ status: 'PLANNED', pageSize: 100 });
  const inProgressQuery = useProcessExecutions({ status: 'IN_PROGRESS', pageSize: 100 });

  const items = useMemo(() => {
    const merged = [...(plannedQuery.data?.items ?? []), ...(inProgressQuery.data?.items ?? [])];
    return merged.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [plannedQuery.data, inProgressQuery.data]);

  return {
    items,
    isLoading: plannedQuery.isLoading || inProgressQuery.isLoading,
    isError: plannedQuery.isError || inProgressQuery.isError,
    refetch: () => {
      void plannedQuery.refetch();
      void inProgressQuery.refetch();
    },
  };
}
