import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { buildTemplateVersion } from '@/test/template-fixtures';
import { templateKeys } from './template-keys';
import { useSaveTemplateDraft } from './use-save-template-draft';

const URL_DRAFT = 'http://localhost:3000/templates/tpl-1/draft';
const input = { templateId: 'tpl-1', content: '<p>nuevo</p>' };

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

describe('useSaveTemplateDraft (T-018-18, CA2)', () => {
  it('refreshes the templates after saving', async () => {
    server.use(http.put(URL_DRAFT, () => HttpResponse.json(buildTemplateVersion())));
    const { queryClient, Wrapper } = createWrapper();
    await queryClient.prefetchQuery({ queryKey: templateKeys.list(), queryFn: async () => ({}) });
    const { result } = renderHook(() => useSaveTemplateDraft(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(queryClient.getQueryState(templateKeys.list())?.isInvalidated).toBe(true);
  });

  it('shares one request among simultaneous saves of the same template', async () => {
    let puts = 0;
    server.use(
      http.put(URL_DRAFT, async () => {
        puts += 1;
        await delay(30);
        return HttpResponse.json(buildTemplateVersion());
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveTemplateDraft(), { wrapper: Wrapper });

    const results = await act(async () =>
      Promise.all([
        result.current.mutateAsync(input),
        result.current.mutateAsync(input),
        result.current.mutateAsync(input),
      ]),
    );

    expect(puts).toBe(1);
    expect(results.every((version) => version.status === 'DRAFT')).toBe(true);
  });

  it('does not share requests between different templates', async () => {
    let puts = 0;
    server.use(
      http.put('http://localhost:3000/templates/:id/draft', async () => {
        puts += 1;
        await delay(30);
        return HttpResponse.json(buildTemplateVersion());
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveTemplateDraft(), { wrapper: Wrapper });

    await act(async () =>
      Promise.all([
        result.current.mutateAsync(input),
        result.current.mutateAsync({ ...input, templateId: 'tpl-2' }),
      ]),
    );

    expect(puts).toBe(2);
  });

  it('refreshes the templates on 409 and allows a manual retry afterwards', async () => {
    let puts = 0;
    server.use(
      http.put(URL_DRAFT, () => {
        puts += 1;
        return puts === 1
          ? HttpResponse.json(
              { error: { code: 'CONFLICT', message: 'Bloqueada' } },
              { status: 409 },
            )
          : HttpResponse.json(buildTemplateVersion());
      }),
    );
    const { queryClient, Wrapper } = createWrapper();
    await queryClient.prefetchQuery({ queryKey: templateKeys.list(), queryFn: async () => ({}) });
    const { result } = renderHook(() => useSaveTemplateDraft(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toMatchObject({ status: 409 });
    });
    expect(queryClient.getQueryState(templateKeys.list())?.isInvalidated).toBe(true);

    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(puts).toBe(2);
  });

  it('does not retry on its own after a server error', async () => {
    let puts = 0;
    server.use(
      http.put(URL_DRAFT, () => {
        puts += 1;
        return HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Falló' } },
          { status: 500 },
        );
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveTemplateDraft(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toMatchObject({ status: 500 });
    });

    expect(puts).toBe(1);
  });
});
