import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import {
  buildEvidenceScale,
  buildLikertScale,
  buildResponseScalesResponse,
} from '@/test/response-scale-fixtures';
import { responseScaleKeys } from './response-scale-keys';
import { useCreateResponseScale } from './use-create-response-scale';
import { useDuplicateResponseScale } from './use-duplicate-response-scale';
import { useResponseScales } from './use-response-scales';
import { useUpdateResponseScale } from './use-update-response-scale';

const BASE = 'http://localhost:3000/response-scales';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

const levels = [
  { label: 'Bajo', value: 1, countsAsAchievement: false },
  { label: 'Alto', value: 2, countsAsAchievement: true },
];

describe('useResponseScales query hook (T-012-16, CA1)', () => {
  it('fetches the scales and caches them under the all-types key', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(buildResponseScalesResponse())));
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => useResponseScales(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(3);
    expect(queryClient.getQueryData(responseScaleKeys.list())).toBeDefined();
  });

  it('uses a different key per type', async () => {
    const requested: (string | null)[] = [];
    server.use(
      http.get(BASE, ({ request }) => {
        requested.push(new URL(request.url).searchParams.get('type'));
        return HttpResponse.json(buildResponseScalesResponse([buildEvidenceScale()]));
      }),
    );
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => useResponseScales('EVIDENCE'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requested).toEqual(['EVIDENCE']);
    expect(queryClient.getQueryData(responseScaleKeys.list('EVIDENCE'))).toBeDefined();
    expect(queryClient.getQueryData(responseScaleKeys.list())).toBeUndefined();
  });

  it('exposes the error without retrying on 403', async () => {
    let calls = 0;
    server.use(
      http.get(BASE, () => {
        calls += 1;
        return HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
          { status: 403 },
        );
      }),
    );
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useResponseScales(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 403 });
    expect(calls).toBe(1);
  });

  it('does not fetch while disabled', async () => {
    let calls = 0;
    server.use(
      http.get(BASE, () => {
        calls += 1;
        return HttpResponse.json(buildResponseScalesResponse());
      }),
    );
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useResponseScales(undefined, { enabled: false }), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(calls).toBe(0);
  });

  it('shares one request among several callers under StrictMode', async () => {
    let calls = 0;
    server.use(
      http.get(BASE, async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return HttpResponse.json(buildResponseScalesResponse());
      }),
    );
    const { queryClient } = createWrapper();
    const StrictWrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StrictMode>
    );

    const first = renderHook(() => useResponseScales(), { wrapper: StrictWrapper });
    const second = renderHook(() => useResponseScales(), { wrapper: StrictWrapper });

    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    expect(calls).toBe(1);
  });
});

describe('response scale mutation hooks (T-012-16)', () => {
  it('useCreateResponseScale posts and invalidates the list', async () => {
    server.use(
      http.post(BASE, () =>
        HttpResponse.json(buildLikertScale({ code: 'NUEVA' }), { status: 201 }),
      ),
    );
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(responseScaleKeys.list(), buildResponseScalesResponse());

    const { result } = renderHook(() => useCreateResponseScale(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ code: 'NUEVA', name: 'Nueva', type: 'LIKERT', levels });
    });

    expect(queryClient.getQueryState(responseScaleKeys.list())?.isInvalidated).toBe(true);
  });

  it('useUpdateResponseScale patches and invalidates the list on success', async () => {
    server.use(
      http.patch(`${BASE}/:id`, () => HttpResponse.json(buildLikertScale({ name: 'Otra' }))),
    );
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(responseScaleKeys.list(), buildResponseScalesResponse());

    const { result } = renderHook(() => useUpdateResponseScale(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'scale-likert', body: { name: 'Otra' } });
    });

    expect(queryClient.getQueryState(responseScaleKeys.list())?.isInvalidated).toBe(true);
  });

  it('useUpdateResponseScale also invalidates the list after a 409 so the card turns in use', async () => {
    server.use(
      http.patch(`${BASE}/:id`, () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'La escala está en uso. Duplícala' } },
          { status: 409 },
        ),
      ),
    );
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(responseScaleKeys.list(), buildResponseScalesResponse());

    const { result } = renderHook(() => useUpdateResponseScale(), { wrapper: Wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ id: 'scale-evidence', body: { name: 'X' } })
        .catch(() => {});
    });

    expect(result.current.error).toMatchObject({ status: 409 });
    expect(queryClient.getQueryState(responseScaleKeys.list())?.isInvalidated).toBe(true);
  });

  it('useDuplicateResponseScale posts and invalidates the list', async () => {
    server.use(
      http.post(`${BASE}/:id/duplicate`, () =>
        HttpResponse.json(buildEvidenceScale({ code: 'COPIA_1' }), { status: 201 }),
      ),
    );
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(responseScaleKeys.list(), buildResponseScalesResponse());

    const { result } = renderHook(() => useDuplicateResponseScale(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        id: 'scale-evidence',
        body: { code: 'COPIA_1', name: 'Copia' },
      });
    });

    expect(queryClient.getQueryState(responseScaleKeys.list())?.isInvalidated).toBe(true);
  });

  it('does not invalidate the list when creating fails', async () => {
    server.use(
      http.post(BASE, () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Código repetido' } },
          { status: 409 },
        ),
      ),
    );
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(responseScaleKeys.list(), buildResponseScalesResponse());

    const { result } = renderHook(() => useCreateResponseScale(), { wrapper: Wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ code: 'NUEVA', name: 'Nueva', type: 'LIKERT', levels })
        .catch(() => {});
    });

    expect(queryClient.getQueryState(responseScaleKeys.list())?.isInvalidated).toBe(false);
  });
});
