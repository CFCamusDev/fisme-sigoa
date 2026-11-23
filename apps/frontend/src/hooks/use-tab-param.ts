import { useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { parseTabParam } from '@/lib/tab-param.js';

export function useTabParam<T extends string>(
  allowed: readonly T[],
  fallback: T,
): [T, (nextTab: T) => void] {
  const search = useSearch({ strict: false }) as Record<string, unknown> | undefined;
  const navigate = useNavigate();

  const currentTab = parseTabParam(search?.tab, allowed, fallback);

  const setTab = useCallback(
    (nextTab: T) => {
      const safeTab = parseTabParam(nextTab, allowed, fallback);
      void navigate({
        to: '.',
        search: ((prev: Record<string, unknown>) => ({
          ...prev,
          tab: safeTab,
        })) as never,
        replace: true,
      });
    },
    [allowed, fallback, navigate],
  );

  return [currentTab, setTab];
}
