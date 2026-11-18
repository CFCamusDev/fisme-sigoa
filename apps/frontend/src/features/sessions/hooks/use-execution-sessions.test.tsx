import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { makeSessionsResponse } from '../test/sessions-fixtures';
import { useExecutionSessions } from './use-execution-sessions';

describe('useExecutionSessions (HU-032, T-032-15)', () => {
  it('does not query without an execution', () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useExecutionSessions(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('passes the pagination', async () => {
    let requestedPage: string | null = null;
    let requestedPageSize: string | null = null;

    server.use(
      http.get('*/process-executions/exec-1/sessions', ({ request }) => {
        const url = new URL(request.url);
        requestedPage = url.searchParams.get('page');
        requestedPageSize = url.searchParams.get('pageSize');
        return HttpResponse.json(makeSessionsResponse([], { page: 2, pageSize: 10, total: 0 }), {
          status: 200,
        });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useExecutionSessions('exec-1', { page: 2, pageSize: 10 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedPage).toBe('2');
    expect(requestedPageSize).toBe('10');
  });
});
