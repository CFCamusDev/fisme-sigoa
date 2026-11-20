import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { useDownloadAnnexPdf } from './use-download-annex-pdf';

const URL_FO_01 = 'http://localhost:3000/annexes/FO-01/pdf';

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

describe('useDownloadAnnexPdf (T-070-06)', () => {
  it('sends a single request for simultaneous downloads of the same annex', async () => {
    let requests = 0;
    server.use(
      http.get(URL_FO_01, async () => {
        requests += 1;
        await delay(30);
        return new HttpResponse(new TextEncoder().encode('%PDF-1.4\nOfficial'), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="fo-01-v1.pdf"',
            'X-Template-Version': '1',
          },
        });
      }),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDownloadAnnexPdf(), { wrapper: Wrapper });

    const results = await act(async () =>
      Promise.all([
        result.current.mutateAsync('FO-01'),
        result.current.mutateAsync('FO-01'),
        result.current.mutateAsync('FO-01'),
      ]),
    );

    expect(requests).toBe(1);
    expect(results.every((item) => item.fileName === 'fo-01-v1.pdf')).toBe(true);
    expect(results.every((item) => item.versionNumber === 1)).toBe(true);
  });

  it('does not retry on 409 conflict', async () => {
    let requests = 0;
    server.use(
      http.get(URL_FO_01, () => {
        requests += 1;
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Ya estás generando un anexo. Espera a que termine.',
            },
          },
          { status: 409 },
        );
      }),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDownloadAnnexPdf(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('FO-01')).rejects.toMatchObject({ status: 409 });
    });

    expect(requests).toBe(1);
  });
});
