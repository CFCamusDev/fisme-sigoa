import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { makeSessionAttendeesResponse } from '../test/sessions-fixtures';
import { useSessionAttendees } from './use-session-attendees';

describe('useSessionAttendees (HU-033, T-033-08)', () => {
  it('does not query without a sessionId', () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSessionAttendees(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches and returns the session attendees roster', async () => {
    const payload = makeSessionAttendeesResponse();
    server.use(
      http.get('*/sessions/sess-1/attendees', () => HttpResponse.json(payload, { status: 200 })),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSessionAttendees('sess-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(payload);
  });
});
