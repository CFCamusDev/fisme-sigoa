import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CatalogVersionDetailDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import {
  buildCatalogAttribute,
  buildCatalogObjective,
  buildCatalogVersionDetail,
} from '@/test/catalog-fixtures';
import { catalogKeys } from './catalog-keys';
import { useCatalogVersionDetail } from './use-catalog-version-detail';
import { useReorderCatalogItems } from './use-reorder-catalog-items';
import { useSaveCatalogItem } from './use-save-catalog-item';

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

describe('useCatalogVersionDetail (T-014-09)', () => {
  it('fetches the detail and caches it under the detail key', async () => {
    server.use(http.get(`${BASE}/cv-2`, () => HttpResponse.json(buildCatalogVersionDetail())));
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => useCatalogVersionDetail('cv-2'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.objectives).toHaveLength(3);
    expect(queryClient.getQueryData(catalogKeys.detail('cv-2'))).toBeDefined();
  });

  it('exposes the error without retrying on 404', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/cv-9`, () => {
        calls += 1;
        return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 });
      }),
    );
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCatalogVersionDetail('cv-9'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(404);
    expect(calls).toBe(1);
  });
});

describe('useSaveCatalogItem (T-014-09, CA1, CA2)', () => {
  it('writes the returned list into the cached detail and refreshes the versions list', async () => {
    const edited = [
      buildCatalogObjective(1),
      buildCatalogObjective(2, { statement: 'Texto nuevo.' }),
      buildCatalogObjective(3),
      buildCatalogObjective(4),
    ];
    let lists = 0;
    server.use(
      http.get(BASE, () => {
        lists += 1;
        return HttpResponse.json({ items: [] });
      }),
      http.put(`${BASE}/cv-2/objectives`, () => HttpResponse.json({ items: edited })),
    );
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(catalogKeys.detail('cv-2'), buildCatalogVersionDetail());
    await queryClient.prefetchQuery({ queryKey: catalogKeys.list(), queryFn: async () => ({}) });

    const { result } = renderHook(() => useSaveCatalogItem('OBJECTIVES', 'cv-2'), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({ id: 'oe-2', code: 'OEP2', statement: 'Texto nuevo.' });
    });

    const cached = queryClient.getQueryData<CatalogVersionDetailDto>(catalogKeys.detail('cv-2'));
    expect(cached?.objectives[1]?.statement).toBe('Texto nuevo.');
    expect(cached?.version.objectiveCount).toBe(4);
    expect(queryClient.getQueryState(catalogKeys.list())?.isInvalidated).toBe(true);
    expect(lists).toBe(0);
  });

  it('saves an attribute through the attribute endpoint', async () => {
    let body: unknown;
    server.use(
      http.put(`${BASE}/cv-2/attributes`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ items: [buildCatalogAttribute(1)] });
      }),
    );
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(catalogKeys.detail('cv-2'), buildCatalogVersionDetail());

    const { result } = renderHook(() => useSaveCatalogItem('ATTRIBUTES', 'cv-2'), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({ code: 'AG-C01', name: 'Atributo 1', statement: 'x' });
    });

    expect(body).toMatchObject({ operation: 'SAVE', name: 'Atributo 1' });
    expect(
      queryClient.getQueryData<CatalogVersionDetailDto>(catalogKeys.detail('cv-2'))?.version
        .attributeCount,
    ).toBe(1);
  });

  it('exposes the 409 error and refetches the detail', async () => {
    let details = 0;
    server.use(
      http.get(`${BASE}/cv-2`, () => {
        details += 1;
        return HttpResponse.json(buildCatalogVersionDetail());
      }),
      http.put(`${BASE}/cv-2/objectives`, () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Código repetido' } },
          { status: 409 },
        ),
      ),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        detail: useCatalogVersionDetail('cv-2'),
        save: useSaveCatalogItem('OBJECTIVES', 'cv-2'),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));

    await act(async () => {
      await result.current.save
        .mutateAsync({ code: 'OEP1', statement: 'x' })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.save.error?.status).toBe(409));
    await waitFor(() => expect(details).toBe(2));
  });

  it('sends one request when save is triggered twice at once', async () => {
    let puts = 0;
    server.use(
      http.put(`${BASE}/cv-2/objectives`, async () => {
        puts += 1;
        await delay(30);
        return HttpResponse.json({ items: [buildCatalogObjective(1)] });
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveCatalogItem('OBJECTIVES', 'cv-2'), {
      wrapper: Wrapper,
    });
    const input = { code: 'OEP1', statement: 'Mismo texto.' };

    const results = await act(async () =>
      Promise.all([
        result.current.mutateAsync(input),
        result.current.mutateAsync(input),
        result.current.mutateAsync(input),
      ]),
    );

    expect(puts).toBe(1);
    expect(results.every((response) => response.items.length === 1)).toBe(true);
  });

  it('allows a manual retry after an error releases the in-flight mark', async () => {
    let puts = 0;
    server.use(
      http.put(`${BASE}/cv-2/objectives`, () => {
        puts += 1;
        return puts === 1
          ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'Falla' } }, { status: 500 })
          : HttpResponse.json({ items: [buildCatalogObjective(1)] });
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveCatalogItem('OBJECTIVES', 'cv-2'), {
      wrapper: Wrapper,
    });
    const input = { code: 'OEP1', statement: 'Texto.' };

    await act(async () => {
      await result.current.mutateAsync(input).catch(() => undefined);
    });
    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(puts).toBe(2);
  });
});

describe('useReorderCatalogItems (T-014-09)', () => {
  it('writes the new order into the cached detail', async () => {
    server.use(
      http.put(`${BASE}/cv-2/attributes`, () =>
        HttpResponse.json({
          items: [buildCatalogAttribute(2, { order: 1 }), buildCatalogAttribute(1, { order: 2 })],
        }),
      ),
    );
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(
      catalogKeys.detail('cv-2'),
      buildCatalogVersionDetail({ attributeCount: 2 }),
    );

    const { result } = renderHook(() => useReorderCatalogItems('ATTRIBUTES', 'cv-2'), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync(['ag-2', 'ag-1']);
    });

    const cached = queryClient.getQueryData<CatalogVersionDetailDto>(catalogKeys.detail('cv-2'));
    expect(cached?.attributes.map((item) => item.code)).toEqual(['AG-C02', 'AG-C01']);
  });

  it('sends one request when the same order is requested twice at once', async () => {
    let puts = 0;
    server.use(
      http.put(`${BASE}/cv-2/objectives`, async () => {
        puts += 1;
        await delay(30);
        return HttpResponse.json({ items: [buildCatalogObjective(1)] });
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReorderCatalogItems('OBJECTIVES', 'cv-2'), {
      wrapper: Wrapper,
    });

    await act(async () =>
      Promise.all([
        result.current.mutateAsync(['oe-2', 'oe-1']),
        result.current.mutateAsync(['oe-2', 'oe-1']),
      ]),
    );

    expect(puts).toBe(1);
  });

  it('refetches the detail when the list is outdated (409)', async () => {
    let details = 0;
    server.use(
      http.get(`${BASE}/cv-2`, () => {
        details += 1;
        return HttpResponse.json(buildCatalogVersionDetail());
      }),
      http.put(`${BASE}/cv-2/objectives`, () =>
        HttpResponse.json({ error: { code: 'CONFLICT', message: 'Desfasada' } }, { status: 409 }),
      ),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        detail: useCatalogVersionDetail('cv-2'),
        reorder: useReorderCatalogItems('OBJECTIVES', 'cv-2'),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));

    await act(async () => {
      await result.current.reorder.mutateAsync(['oe-2', 'oe-1']).catch(() => undefined);
    });

    await waitFor(() => expect(details).toBe(2));
  });
});
