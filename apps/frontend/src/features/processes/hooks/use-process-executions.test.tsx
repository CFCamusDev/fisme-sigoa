import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import {
  SAMPLE_PROCESS_EXECUTION_DTO,
  makeProcessExecutionsResponse,
} from '../test/process-executions-fixtures';
import { useProcessExecutions } from './use-process-executions';

describe('useProcessExecutions (HU-027, T-027-12)', () => {
  it('passes the filters and pagination', async () => {
    let capturedUrl = '';
    server.use(
      http.get('*/process-executions', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(makeProcessExecutionsResponse([SAMPLE_PROCESS_EXECUTION_DTO]));
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () =>
        useProcessExecutions({
          type: 'P612',
          year: 2027,
          status: 'PLANNED',
          page: 2,
          pageSize: 10,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('type')).toBe('P612');
    expect(url.searchParams.get('year')).toBe('2027');
    expect(url.searchParams.get('status')).toBe('PLANNED');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('10');
  });
});
