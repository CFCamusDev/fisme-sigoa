import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { SAMPLE_OPEN_EXECUTIONS } from '../test/sessions-fixtures';
import { useLinkableProcessExecutions } from './use-linkable-process-executions';

describe('useLinkableProcessExecutions (HU-032, T-032-15)', () => {
  it('merges the planned and in-progress executions', async () => {
    server.use(
      http.get('*/process-executions', ({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        const items =
          status === 'PLANNED'
            ? SAMPLE_OPEN_EXECUTIONS.filter((item) => item.status === 'PLANNED')
            : SAMPLE_OPEN_EXECUTIONS.filter((item) => item.status === 'IN_PROGRESS');

        return HttpResponse.json(
          {
            items,
            page: 1,
            pageSize: 100,
            total: items.length,
            totalPages: 1,
          },
          { status: 200 },
        );
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLinkableProcessExecutions(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items.map((item) => item.id)).toEqual(['exec-3', 'exec-2', 'exec-1']);
  });
});
