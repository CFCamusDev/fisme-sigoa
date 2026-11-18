import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { SAMPLE_SESSION_DTO, makeSessionsResponse } from '../test/sessions-fixtures';
import { useCreateSession } from './use-create-session';
import { useExecutionSessions } from './use-execution-sessions';

describe('useCreateSession (HU-032, T-032-15)', () => {
  it('shares one request among simultaneous identical submissions', async () => {
    let postCalls = 0;
    server.use(
      http.post('*/sessions', async () => {
        postCalls += 1;
        await delay(30);
        return HttpResponse.json(SAMPLE_SESSION_DTO, { status: 201 });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StrictMode>
    );

    const { result } = renderHook(() => useCreateSession(), { wrapper });

    const payload = {
      stakeholderType: 'EMPLOYER' as const,
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON' as const,
      executionIds: ['exec-1'],
    };

    await act(async () => {
      const [first, second] = await Promise.all([
        result.current.mutateAsync(payload),
        result.current.mutateAsync(payload),
      ]);
      expect(first).toEqual(second);
    });

    expect(postCalls).toBe(1);
  });

  it('invalidates the sessions on success and on 409', async () => {
    let listCalls = 0;
    let shouldConflict = false;

    server.use(
      http.get('*/process-executions/exec-1/sessions', () => {
        listCalls += 1;
        return HttpResponse.json(makeSessionsResponse(), { status: 200 });
      }),
      http.post('*/sessions', () => {
        if (shouldConflict) {
          return HttpResponse.json({ message: 'Sesión duplicada' }, { status: 409 });
        }
        return HttpResponse.json(SAMPLE_SESSION_DTO, { status: 201 });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const listHook = renderHook(() => useExecutionSessions('exec-1'), { wrapper });
    await waitFor(() => expect(listHook.result.current.isSuccess).toBe(true));
    expect(listCalls).toBe(1);

    const mutationHook = renderHook(() => useCreateSession(), { wrapper });
    await act(async () => {
      await mutationHook.result.current.mutateAsync({
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executionIds: ['exec-1'],
      });
    });

    await waitFor(() => expect(listCalls).toBe(2));

    shouldConflict = true;
    await act(async () => {
      await expect(
        mutationHook.result.current.mutateAsync({
          stakeholderType: 'EMPLOYER',
          sessionDate: '2026-11-20',
          startTime: '10:00',
          modality: 'IN_PERSON',
          executionIds: ['exec-1'],
        }),
      ).rejects.toBeDefined();
    });

    await waitFor(() => expect(listCalls).toBe(3));
  });
});
