import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { makeCurrentCommitteeResponse } from '../test/quality-committee-fixtures';
import { useCurrentQualityCommittee } from './use-current-quality-committee';

describe('useCurrentQualityCommittee (T-025-17)', () => {
  it('fetches the current committee, actor membership and alerts', async () => {
    const payload = makeCurrentCommitteeResponse({
      actorMembership: { memberId: 'mem-1', position: 'PRESIDENT' },
      alerts: [{ userId: 'usr-old', fullName: 'Pedro Salas' }],
    });
    server.use(
      http.get('*/quality-committees/current', () => HttpResponse.json(payload, { status: 200 })),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCurrentQualityCommittee(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(payload);
  });
});
