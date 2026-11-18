import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { makeSessionAttendeesResponse } from '../test/sessions-fixtures';
import { useRegisterSessionAttendees } from './use-register-session-attendees';
import { useSessionAttendees } from './use-session-attendees';

describe('useRegisterSessionAttendees (HU-033, T-033-08)', () => {
  it('shares one request among simultaneous identical submissions', async () => {
    let putCalls = 0;
    const payload = makeSessionAttendeesResponse();
    server.use(
      http.put('*/sessions/sess-1/attendees', async () => {
        putCalls += 1;
        await delay(30);
        return HttpResponse.json(payload, { status: 200 });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StrictMode>
    );

    const { result } = renderHook(() => useRegisterSessionAttendees(), { wrapper });

    await act(async () => {
      const [first, second] = await Promise.all([
        result.current.mutateAsync({
          sessionId: 'sess-1',
          data: { attendees: [{ listMemberId: 'mem-1', position: 'Gerente de TI' }] },
        }),
        result.current.mutateAsync({
          sessionId: 'sess-1',
          data: { attendees: [{ listMemberId: 'mem-1', position: 'Gerente de TI' }] },
        }),
      ]);
      expect(first).toEqual(second);
    });

    expect(putCalls).toBe(1);
  });

  it('invalidates session attendees on success and on 409', async () => {
    let getCalls = 0;
    let shouldConflict = false;
    const payload = makeSessionAttendeesResponse();

    server.use(
      http.get('*/sessions/sess-1/attendees', () => {
        getCalls += 1;
        return HttpResponse.json(payload, { status: 200 });
      }),
      http.put('*/sessions/sess-1/attendees', () => {
        if (shouldConflict) {
          return HttpResponse.json({ message: 'Ejecución cerrada' }, { status: 409 });
        }
        return HttpResponse.json(payload, { status: 200 });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const queryHook = renderHook(() => useSessionAttendees('sess-1'), { wrapper });
    await waitFor(() => expect(queryHook.result.current.isSuccess).toBe(true));
    expect(getCalls).toBe(1);

    const mutationHook = renderHook(() => useRegisterSessionAttendees(), { wrapper });
    await act(async () => {
      await mutationHook.result.current.mutateAsync({
        sessionId: 'sess-1',
        data: { attendees: [{ listMemberId: 'mem-1', position: 'Gerente de TI' }] },
      });
    });

    await waitFor(() => expect(getCalls).toBe(2));

    shouldConflict = true;
    await act(async () => {
      await expect(
        mutationHook.result.current.mutateAsync({
          sessionId: 'sess-1',
          data: { attendees: [] },
        }),
      ).rejects.toThrow();
    });

    await waitFor(() => expect(getCalls).toBe(3));
  });
});
