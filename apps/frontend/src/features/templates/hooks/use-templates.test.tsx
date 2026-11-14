import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import {
  buildTemplateDetail,
  buildTemplateSummary,
  buildTemplatesResponse,
} from '@/test/template-fixtures';
import { useTemplateDetail } from './use-template-detail';
import { useTemplates } from './use-templates';

const BASE = 'http://localhost:3000/templates';

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useTemplates (T-018-18)', () => {
  it('loads the list with the filters', async () => {
    let search = '';
    server.use(
      http.get(BASE, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json(buildTemplatesResponse([buildTemplateSummary()]));
      }),
    );

    const { result } = renderHook(() => useTemplates({ type: 'ANNEX' }), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(search).toContain('type=ANNEX');
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('exposes the server status on error without retrying', async () => {
    let gets = 0;
    server.use(
      http.get(BASE, () => {
        gets += 1;
        return HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
          { status: 403 },
        );
      }),
    );

    const { result } = renderHook(() => useTemplates(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(403);
    expect(gets).toBe(1);
  });
});

describe('useTemplateDetail (T-018-18)', () => {
  it('does not request anything without a template id', async () => {
    let gets = 0;
    server.use(
      http.get(`${BASE}/:id`, () => {
        gets += 1;
        return HttpResponse.json(buildTemplateDetail());
      }),
    );

    const { result } = renderHook(() => useTemplateDetail(undefined), { wrapper: wrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(gets).toBe(0);
  });

  it('loads the detail of the chosen template', async () => {
    server.use(
      http.get(`${BASE}/tpl-1`, () => HttpResponse.json(buildTemplateDetail({ withDraft: true }))),
    );

    const { result } = renderHook(() => useTemplateDetail('tpl-1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.draft?.number).toBe(2);
  });
});
