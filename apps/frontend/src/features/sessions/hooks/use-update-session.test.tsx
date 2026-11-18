import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { SAMPLE_SESSION_DTO, makeSessionsResponse } from '../test/sessions-fixtures';
import { useExecutionSessions } from './use-execution-sessions';
import { useUpdateSession } from './use-update-session';

describe('useUpdateSession (HU-032, T-032-15)', () => {
  it('shares one request among simultaneous identical submissions', async () => {
    let patchCalls = 0;
    server.use(
      http.patch('*/sessions/sess-1', async () => {
        patchCalls += 1;
        await delay(30);
        return HttpResponse.json({ ...SAMPLE_SESSION_DTO, startTime: '11:30' }, { status: 200 });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StrictMode>
    );

    const { result } = renderHook(() => useUpdateSession(), { wrapper });

    await act(async () => {
      const [first, second] = await Promise.all([
        result.current.mutateAsync({ id: 'sess-1', data: { startTime: '11:30' } }),
        result.current.mutateAsync({ id: 'sess-1', data: { startTime: '11:30' } }),
      ]);
      expect(first).toEqual(second);
    });

    expect(patchCalls).toBe(1);
  });

  it('invalidates the sessions on success and on 409', async () => {
    let listCalls = 0;
    let shouldConflict = false;

    server.use(
      http.get('*/process-executions/exec-1/sessions', () => {
        listCalls += 1;
        return HttpResponse.json(makeSessionsResponse(), { status: 200 });
      }),
      http.patch('*/sessions/sess-1', () => {
        if (shouldConflict) {
          return HttpResponse.json({ message: 'Ejecución cerrada' }, { status: 409 });
        }
        return HttpResponse.json(SAMPLE_SESSION_DTO, { status: 200 });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const listHook = renderHook(() => useExecutionSessions('exec-1'), { wrapper });
    await waitFor(() => expect(listHook.result.current.isSuccess).toBe(true));
    expect(listCalls).toBe(1);

    const mutationHook = renderHook(() => useUpdateSession(), { wrapper });
    await act(async () => {
      await mutationHook.result.current.mutateAsync({
        id: 'sess-1',
        data: { startTime: '11:30' },
      });
    });

    await waitFor(() => expect(listCalls).toBe(2));

    shouldConflict = true;
    await act(async () => {
      await expect(
        mutationHook.result.current.mutateAsync({
          id: 'sess-1',
          data: { startTime: '12:00' },
        }),
      ).rejects.toBeDefined();
    });

    await waitFor(() => expect(listCalls).toBe(3));
  });
});
