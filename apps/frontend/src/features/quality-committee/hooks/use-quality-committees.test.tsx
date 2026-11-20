import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { makeCommitteeListResponse } from '../test/quality-committee-fixtures';
import { useQualityCommittees } from './use-quality-committees';

describe('useQualityCommittees (T-025-17)', () => {
  it('fetches paginated committee history', async () => {
    const payload = makeCommitteeListResponse();
    server.use(http.get('*/quality-committees', () => HttpResponse.json(payload, { status: 200 })));

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useQualityCommittees({ page: 1, pageSize: 10 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(payload);
  });
});
