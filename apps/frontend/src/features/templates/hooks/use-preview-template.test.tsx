import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { templateKeys } from './template-keys';
import { usePreviewTemplate } from './use-preview-template';

const URL_PREVIEW = 'http://localhost:3000/templates/tpl-1/preview';
const input = { templateId: 'tpl-1', content: '<p>{{program.name}}</p>' };
const previewPayload = {
  pdfBase64: 'JVBERi0xLjQK',
  warnings: [{ variable: 'unknown.key' }],
};

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

describe('usePreviewTemplate (T-019-06, CA1, CA2)', () => {
  it('sends a single request for simultaneous previews of the same content', async () => {
    let posts = 0;
    server.use(
      http.post(URL_PREVIEW, async () => {
        posts += 1;
        await delay(30);
        return HttpResponse.json(previewPayload);
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePreviewTemplate(), { wrapper: Wrapper });

    const results = await act(async () =>
      Promise.all([
        result.current.mutateAsync(input),
        result.current.mutateAsync(input),
        result.current.mutateAsync(input),
      ]),
    );

    expect(posts).toBe(1);
    expect(results.every((item) => item.pdfBase64 === previewPayload.pdfBase64)).toBe(true);
    expect(results[0]?.warnings).toEqual([{ variable: 'unknown.key' }]);
  });

  it('does not invalidate queries or retry on 409', async () => {
    let posts = 0;
    server.use(
      http.post(URL_PREVIEW, () => {
        posts += 1;
        return HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Ya hay una vista previa en curso' } },
          { status: 409 },
        );
      }),
    );
    const { queryClient, Wrapper } = createWrapper();
    await queryClient.prefetchQuery({
      queryKey: templateKeys.detail('tpl-1'),
      queryFn: async () => ({}),
    });
    const { result } = renderHook(() => usePreviewTemplate(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toMatchObject({ status: 409 });
    });

    expect(posts).toBe(1);
    expect(queryClient.getQueryState(templateKeys.detail('tpl-1'))?.isInvalidated).toBe(false);
  });
});
