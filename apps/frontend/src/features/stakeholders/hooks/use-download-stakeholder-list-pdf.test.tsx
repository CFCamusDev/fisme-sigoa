import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { useDownloadStakeholderListPdf } from './use-download-stakeholder-list-pdf';

describe('useDownloadStakeholderListPdf (T-026-05)', () => {
  it('shares a single network request across concurrent callers under StrictMode', async () => {
    let calls = 0;
    server.use(
      http.get('*/stakeholder-lists/:id/pdf', async () => {
        calls += 1;
        await delay(30);
        return new HttpResponse('%PDF-1.4\nAnexo 3', {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="fo-03-2026-v1.pdf"',
          },
        });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StrictMode>
    );

    const { result } = renderHook(() => useDownloadStakeholderListPdf(), { wrapper });

    await act(async () => {
      const [first, second] = await Promise.all([
        result.current.mutateAsync({ listId: 'list-2026' }),
        result.current.mutateAsync({ listId: 'list-2026' }),
      ]);
      expect(first.fileName).toBe('fo-03-2026-v1.pdf');
      expect(second.fileName).toBe('fo-03-2026-v1.pdf');
    });

    expect(calls).toBe(1);
  });
});
