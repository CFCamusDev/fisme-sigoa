import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { DRAFT_UPDATED_AT, buildTemplateVersion } from '@/test/template-fixtures';
import { templateKeys } from './template-keys';
import { usePublishTemplate } from './use-publish-template';

const URL_PUBLISH = 'http://localhost:3000/templates/tpl-1/publish';
const input = { templateId: 'tpl-1', versionId: 'ver-2', expectedUpdatedAt: DRAFT_UPDATED_AT };
const published = buildTemplateVersion({
  status: 'PUBLISHED',
  publishedAt: '2026-11-14T09:00:00.000Z',
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StrictMode>
  );
  return { queryClient, Wrapper };
}

describe('usePublishTemplate (T-018-18, CA2)', () => {
  it('refreshes the templates after publishing', async () => {
    server.use(http.post(URL_PUBLISH, () => HttpResponse.json(published)));
    const { queryClient, Wrapper } = createWrapper();
    await queryClient.prefetchQuery({
      queryKey: templateKeys.detail('tpl-1'),
      queryFn: async () => ({}),
    });
    const { result } = renderHook(() => usePublishTemplate(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(queryClient.getQueryState(templateKeys.detail('tpl-1'))?.isInvalidated).toBe(true);
  });

  it('shares one request among simultaneous publications of the same draft', async () => {
    let posts = 0;
    server.use(
      http.post(URL_PUBLISH, async () => {
        posts += 1;
        await delay(30);
        return HttpResponse.json(published);
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePublishTemplate(), { wrapper: Wrapper });

    const results = await act(async () =>
      Promise.all([
        result.current.mutateAsync(input),
        result.current.mutateAsync(input),
        result.current.mutateAsync(input),
      ]),
    );

    expect(posts).toBe(1);
    expect(results.every((version) => version.status === 'PUBLISHED')).toBe(true);
  });

  it('refreshes the templates on 409 and does not publish again on its own', async () => {
    let posts = 0;
    server.use(
      http.post(URL_PUBLISH, () => {
        posts += 1;
        return HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Cambió' } },
          { status: 409 },
        );
      }),
    );
    const { queryClient, Wrapper } = createWrapper();
    await queryClient.prefetchQuery({
      queryKey: templateKeys.detail('tpl-1'),
      queryFn: async () => ({}),
    });
    const { result } = renderHook(() => usePublishTemplate(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toMatchObject({ status: 409 });
    });

    expect(posts).toBe(1);
    expect(queryClient.getQueryState(templateKeys.detail('tpl-1'))?.isInvalidated).toBe(true);
  });

  it('refreshes the templates on 404', async () => {
    server.use(
      http.post(URL_PUBLISH, () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'No existe' } }, { status: 404 }),
      ),
    );
    const { queryClient, Wrapper } = createWrapper();
    await queryClient.prefetchQuery({ queryKey: templateKeys.list(), queryFn: async () => ({}) });
    const { result } = renderHook(() => usePublishTemplate(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toMatchObject({ status: 404 });
    });

    expect(queryClient.getQueryState(templateKeys.list())?.isInvalidated).toBe(true);
  });
});
