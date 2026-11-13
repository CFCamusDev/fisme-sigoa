import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CatalogVersionDetailDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { buildCatalogVersion, buildCatalogVersionDetail } from '@/test/catalog-fixtures';
import { catalogKeys } from './catalog-keys';
import { useCatalogVersionDetail } from './use-catalog-version-detail';
import { useSendCatalogVersionToValidation } from './use-send-catalog-version-to-validation';

const BASE = 'http://localhost:3000/catalog-versions';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

const validated = () => buildCatalogVersion({ id: 'cv-2', number: 2, status: 'IN_VALIDATION' });

describe('useSendCatalogVersionToValidation (T-015-05, CA1, CA2)', () => {
  it('writes the returned version into the cached detail and refreshes the list', async () => {
    let lists = 0;
    server.use(
      http.get(BASE, () => {
        lists += 1;
        return HttpResponse.json({ items: [] });
      }),
      http.post(`${BASE}/cv-2/validation`, () => HttpResponse.json(validated())),
    );
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(catalogKeys.detail('cv-2'), buildCatalogVersionDetail());
    await queryClient.prefetchQuery({ queryKey: catalogKeys.list(), queryFn: async () => ({}) });

    const { result } = renderHook(() => useSendCatalogVersionToValidation('cv-2'), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync();
    });

    const detail = queryClient.getQueryData<CatalogVersionDetailDto>(catalogKeys.detail('cv-2'));
    expect(detail?.version.status).toBe('IN_VALIDATION');
    expect(detail?.objectives).toHaveLength(3);
    expect(queryClient.getQueryState(catalogKeys.list())?.isInvalidated).toBe(true);
    expect(lists).toBe(0);
  });

  it('sends one request for several simultaneous calls', async () => {
    let posts = 0;
    server.use(
      http.post(`${BASE}/cv-2/validation`, async () => {
        posts += 1;
        await delay(30);
        return HttpResponse.json(validated());
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSendCatalogVersionToValidation('cv-2'), {
      wrapper: Wrapper,
    });

    const results = await act(async () =>
      Promise.all([
        result.current.mutateAsync(),
        result.current.mutateAsync(),
        result.current.mutateAsync(),
      ]),
    );

    expect(posts).toBe(1);
    expect(results.every((version) => version.status === 'IN_VALIDATION')).toBe(true);
  });

  it('allows a manual retry after an error releases the in-flight mark', async () => {
    let posts = 0;
    server.use(
      http.post(`${BASE}/cv-2/validation`, () => {
        posts += 1;
        return posts === 1
          ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'Falla' } }, { status: 500 })
          : HttpResponse.json(validated());
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSendCatalogVersionToValidation('cv-2'), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(posts).toBe(2);
  });

  it.each([404, 409])('refetches the detail when the server answers %s', async (status) => {
    let details = 0;
    server.use(
      http.get(`${BASE}/cv-2`, () => {
        details += 1;
        return HttpResponse.json(buildCatalogVersionDetail());
      }),
      http.post(`${BASE}/cv-2/validation`, () =>
        HttpResponse.json({ error: { code: 'CONFLICT', message: 'Ya enviada' } }, { status }),
      ),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        detail: useCatalogVersionDetail('cv-2'),
        send: useSendCatalogVersionToValidation('cv-2'),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));

    await act(async () => {
      await result.current.send.mutateAsync().catch(() => undefined);
    });

    await waitFor(() => expect(details).toBe(2));
    expect(result.current.send.error?.status).toBe(status);
  });
});
