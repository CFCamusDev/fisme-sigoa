import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { buildResolution } from '@/test/resolution-fixtures';
import { resolutionKeys } from './resolution-keys';
import { useRegisterResolution } from './use-register-resolution';

const BASE = 'http://localhost:3000/resolutions';

const input = {
  type: 'EDUCATIONAL_OBJECTIVE',
  number: 'RD-012/2027-FISME',
  issuedOn: '2026-11-10',
  catalogVersionId: 'cv-2',
} as const;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('useRegisterResolution (T-048-13, CA1)', () => {
  it('refreshes the list after registering', async () => {
    server.use(http.post(BASE, () => HttpResponse.json(buildResolution(), { status: 201 })));
    const { queryClient, Wrapper } = createWrapper();
    await queryClient.prefetchQuery({ queryKey: resolutionKeys.list(), queryFn: async () => ({}) });
    const { result } = renderHook(() => useRegisterResolution(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(queryClient.getQueryState(resolutionKeys.list())?.isInvalidated).toBe(true);
  });

  it('sends one request for several simultaneous calls', async () => {
    let posts = 0;
    server.use(
      http.post(BASE, async () => {
        posts += 1;
        await delay(30);
        return HttpResponse.json(buildResolution(), { status: 201 });
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRegisterResolution(), { wrapper: Wrapper });

    const results = await act(async () =>
      Promise.all([
        result.current.mutateAsync(input),
        result.current.mutateAsync(input),
        result.current.mutateAsync(input),
      ]),
    );

    expect(posts).toBe(1);
    expect(results.every((resolution) => resolution.status === 'REGISTERED')).toBe(true);
  });

  it('allows a manual retry after a 409 releases the in-flight mark', async () => {
    let posts = 0;
    server.use(
      http.post(BASE, () => {
        posts += 1;
        return posts === 1
          ? HttpResponse.json(
              { error: { code: 'CONFLICT', message: 'Duplicada' } },
              { status: 409 },
            )
          : HttpResponse.json(buildResolution(), { status: 201 });
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRegisterResolution(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(input).catch(() => undefined);
    });
    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(posts).toBe(2);
  });
});
