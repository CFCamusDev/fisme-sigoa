import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { buildApprovedResolution, buildResolutionsResponse } from '@/test/resolution-fixtures';
import { resolutionKeys } from './resolution-keys';
import { useApproveResolution } from './use-approve-resolution';
import { useResolutions } from './use-resolutions';

const BASE = 'http://localhost:3000/resolutions';
const pdf = () => new Blob(['%PDF-1.4\n'], { type: 'application/pdf' });

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('useApproveResolution (T-048-13, CA2)', () => {
  it('refreshes the list after approving', async () => {
    server.use(
      http.post(`${BASE}/res-1/approve`, () => HttpResponse.json(buildApprovedResolution())),
    );
    const { queryClient, Wrapper } = createWrapper();
    await queryClient.prefetchQuery({ queryKey: resolutionKeys.list(), queryFn: async () => ({}) });
    const { result } = renderHook(() => useApproveResolution(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ resolutionId: 'res-1', file: pdf() });
    });

    expect(queryClient.getQueryState(resolutionKeys.list())?.isInvalidated).toBe(true);
  });

  it('sends one request for several simultaneous calls', async () => {
    let posts = 0;
    server.use(
      http.post(`${BASE}/res-1/approve`, async () => {
        posts += 1;
        await delay(30);
        return HttpResponse.json(buildApprovedResolution());
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useApproveResolution(), { wrapper: Wrapper });

    const results = await act(async () =>
      Promise.all([
        result.current.mutateAsync({ resolutionId: 'res-1', file: pdf() }),
        result.current.mutateAsync({ resolutionId: 'res-1', file: pdf() }),
        result.current.mutateAsync({ resolutionId: 'res-1', file: pdf() }),
      ]),
    );

    expect(posts).toBe(1);
    expect(results.every((resolution) => resolution.status === 'APPROVED')).toBe(true);
  });

  it('sends one request per resolution when different ones are approved together', async () => {
    let posts = 0;
    server.use(
      http.post(`${BASE}/:id/approve`, async ({ params }) => {
        posts += 1;
        await delay(30);
        return HttpResponse.json(buildApprovedResolution({ id: String(params.id) }));
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useApproveResolution(), { wrapper: Wrapper });

    await act(async () =>
      Promise.all([
        result.current.mutateAsync({ resolutionId: 'res-1', file: pdf() }),
        result.current.mutateAsync({ resolutionId: 'res-2', file: pdf() }),
      ]),
    );

    expect(posts).toBe(2);
  });

  it('allows a manual retry after an error releases the in-flight mark', async () => {
    let posts = 0;
    server.use(
      http.post(`${BASE}/res-1/approve`, () => {
        posts += 1;
        return posts === 1
          ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'Falla' } }, { status: 500 })
          : HttpResponse.json(buildApprovedResolution());
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useApproveResolution(), { wrapper: Wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ resolutionId: 'res-1', file: pdf() })
        .catch(() => undefined);
    });
    await act(async () => {
      await result.current.mutateAsync({ resolutionId: 'res-1', file: pdf() });
    });

    expect(posts).toBe(2);
  });

  it.each([404, 409])('refetches the list when the server answers %s', async (status) => {
    let lists = 0;
    server.use(
      http.get(BASE, () => {
        lists += 1;
        return HttpResponse.json(buildResolutionsResponse([]));
      }),
      http.post(`${BASE}/res-1/approve`, () =>
        HttpResponse.json({ error: { code: 'CONFLICT', message: 'Ya aprobada' } }, { status }),
      ),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({ list: useResolutions(), approve: useApproveResolution() }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(async () => {
      await result.current.approve
        .mutateAsync({ resolutionId: 'res-1', file: pdf() })
        .catch(() => undefined);
    });

    await waitFor(() => expect(lists).toBe(2));
    expect(result.current.approve.error?.status).toBe(status);
  });
});
