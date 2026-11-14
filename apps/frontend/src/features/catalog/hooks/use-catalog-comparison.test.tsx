import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { buildCatalogComparison } from '@/test/catalog-fixtures';
import { getCatalogComparison } from '../api/get-catalog-comparison';
import { catalogKeys } from './catalog-keys';
import { useCatalogComparison } from './use-catalog-comparison';

const URL_PATTERN = 'http://localhost:3000/catalog-versions/:baseId/compare/:targetId';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('catalog comparison API and hook (HU-017, T-017-11)', () => {
  it('encodes both identifiers in the path and parses the response', async () => {
    let pathname = '';
    server.use(
      http.get(URL_PATTERN, ({ request }) => {
        pathname = new URL(request.url).pathname;
        return HttpResponse.json(buildCatalogComparison());
      }),
    );

    const result = await getCatalogComparison('a/b', 'c d');

    expect(pathname).toBe('/catalog-versions/a%2Fb/compare/c%20d');
    expect(result.summary.modified).toBe(1);
  });

  it('rejects a response that does not match the shared schema', async () => {
    server.use(http.get(URL_PATTERN, () => HttpResponse.json({ base: {} })));

    await expect(getCatalogComparison('cv-1', 'cv-2')).rejects.toThrow();
  });

  it('fetches once for two different versions and caches under the comparison key', async () => {
    let calls = 0;
    server.use(
      http.get(URL_PATTERN, () => {
        calls += 1;
        return HttpResponse.json(buildCatalogComparison());
      }),
    );
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => useCatalogComparison('cv-1', 'cv-2'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls).toBe(1);
    expect(queryClient.getQueryData(catalogKeys.comparison('cv-1', 'cv-2'))).toBeDefined();
  });

  it.each([
    ['no selection', undefined, undefined],
    ['only the base', 'cv-1', undefined],
    ['the same version twice', 'cv-1', 'cv-1'],
  ])('sends no request for %s', async (_label, baseId, targetId) => {
    let calls = 0;
    server.use(
      http.get(URL_PATTERN, () => {
        calls += 1;
        return HttpResponse.json(buildCatalogComparison());
      }),
    );
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCatalogComparison(baseId, targetId), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(result.current.isSuccess).toBe(false);
    expect(calls).toBe(0);
  });
});
