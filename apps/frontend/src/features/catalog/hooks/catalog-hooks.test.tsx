import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { buildCatalogVersion, buildCatalogVersionsResponse } from '@/test/catalog-fixtures';
import { catalogKeys } from './catalog-keys';
import { useCatalogVersions } from './use-catalog-versions';
import { useCreateCatalogVersion } from './use-create-catalog-version';

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

describe('useCatalogVersions query hook (T-013-15)', () => {
  it('fetches the versions and caches them under the list key', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(buildCatalogVersionsResponse())));
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => useCatalogVersions(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
    expect(queryClient.getQueryData(catalogKeys.list())).toBeDefined();
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

    const { result } = renderHook(() => useCatalogVersions(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(403);
    expect(calls).toBe(1);
  });
});

describe('useCreateCatalogVersion mutation hook (T-013-15, CA1, CA2)', () => {
  it('creates the draft and invalidates the list so it is fetched again', async () => {
    let lists = 0;
    server.use(
      http.get(BASE, () => {
        lists += 1;
        return HttpResponse.json(
          buildCatalogVersionsResponse({ open: lists > 1 ? 'DRAFT' : undefined }),
        );
      }),
      http.post(BASE, () =>
        HttpResponse.json(
          buildCatalogVersion({ id: 'cv-2', number: 2, status: 'DRAFT', basedOnVersionId: 'cv-1' }),
          { status: 201 },
        ),
      ),
    );
    const { Wrapper } = createWrapper();
    const list = renderHook(() => useCatalogVersions(), { wrapper: Wrapper });
    const create = renderHook(() => useCreateCatalogVersion(), { wrapper: Wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));

    await act(async () => {
      await create.result.current.mutateAsync();
    });

    await waitFor(() => expect(lists).toBe(2));
  });

  it('does not retry and still refreshes the list when the server answers 409', async () => {
    let posts = 0;
    let lists = 0;
    server.use(
      http.get(BASE, () => {
        lists += 1;
        return HttpResponse.json(buildCatalogVersionsResponse());
      }),
      http.post(BASE, () => {
        posts += 1;
        return HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Ya existe una versión abierta' } },
          { status: 409 },
        );
      }),
    );
    const { Wrapper } = createWrapper();
    const list = renderHook(() => useCatalogVersions(), { wrapper: Wrapper });
    const create = renderHook(() => useCreateCatalogVersion(), { wrapper: Wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));

    await act(async () => {
      await expect(create.result.current.mutateAsync()).rejects.toMatchObject({ status: 409 });
    });

    expect(posts).toBe(1);
    await waitFor(() => expect(lists).toBe(2));
  });
});
