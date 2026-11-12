import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { buildParametersResponseWithNewVersion } from '@/test/parameter-fixtures';
import { parameterKeys } from './parameter-keys';
import { useDefineParameters } from './use-define-parameters';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

const body = { semesterCode: '2027-I', values: [{ key: 'UMBRAL_LOGRADO' as const, value: 15 }] };

describe('useDefineParameters mutation hook (T-011-12, CA2)', () => {
  it('defines the parameters and invalidates every parameters query on success', async () => {
    server.use(
      http.post('http://localhost:3000/parameters', () =>
        HttpResponse.json(buildParametersResponseWithNewVersion(), { status: 201 }),
      ),
    );
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDefineParameters(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync(body);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: parameterKeys.all });
  });

  it('does not invalidate nor retry when the server answers 409', async () => {
    let calls = 0;
    server.use(
      http.post('http://localhost:3000/parameters', () => {
        calls += 1;
        return HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Conflicto' } },
          { status: 409 },
        );
      }),
    );
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDefineParameters(), { wrapper: Wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(body)).rejects.toBeDefined();
    });

    expect(calls).toBe(1);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
