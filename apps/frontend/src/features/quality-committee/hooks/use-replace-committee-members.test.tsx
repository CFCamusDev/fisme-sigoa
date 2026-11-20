import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import {
  SAMPLE_CURRENT_COMMITTEE,
  makeCurrentCommitteeResponse,
} from '../test/quality-committee-fixtures';
import { useCurrentQualityCommittee } from './use-current-quality-committee';
import { useReplaceCommitteeMembers } from './use-replace-committee-members';

describe('useReplaceCommitteeMembers (T-025-17)', () => {
  it('shares one request for simultaneous calls', async () => {
    let putCalls = 0;
    server.use(
      http.put('*/quality-committees/com-2027/members', async () => {
        putCalls += 1;
        await delay(30);
        return HttpResponse.json(SAMPLE_CURRENT_COMMITTEE, { status: 200 });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StrictMode>
    );

    const { result } = renderHook(() => useReplaceCommitteeMembers(), { wrapper });
    const variables = {
      committeeId: 'com-2027',
      body: {
        members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' as const }],
      },
    };

    await act(async () => {
      const [first, second] = await Promise.all([
        result.current.mutateAsync(variables),
        result.current.mutateAsync(variables),
      ]);
      expect(first).toEqual(second);
    });

    expect(putCalls).toBe(1);
  });

  it('invalidates the committee queries on success and on 409', async () => {
    let currentCalls = 0;
    let shouldConflict = false;

    server.use(
      http.get('*/quality-committees/current', () => {
        currentCalls += 1;
        return HttpResponse.json(makeCurrentCommitteeResponse(), { status: 200 });
      }),
      http.put('*/quality-committees/com-2027/members', () => {
        if (shouldConflict) {
          return HttpResponse.json({ message: 'Periodo finalizado' }, { status: 409 });
        }
        return HttpResponse.json(SAMPLE_CURRENT_COMMITTEE, { status: 200 });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const currentHook = renderHook(() => useCurrentQualityCommittee(), { wrapper });
    await waitFor(() => expect(currentHook.result.current.isSuccess).toBe(true));
    expect(currentCalls).toBe(1);

    const mutationHook = renderHook(() => useReplaceCommitteeMembers(), { wrapper });
    const variables = {
      committeeId: 'com-2027',
      body: {
        members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' as const }],
      },
    };

    await act(async () => {
      await mutationHook.result.current.mutateAsync(variables);
    });
    await waitFor(() => expect(currentCalls).toBe(2));

    shouldConflict = true;
    await act(async () => {
      await expect(mutationHook.result.current.mutateAsync(variables)).rejects.toBeDefined();
    });
    await waitFor(() => expect(currentCalls).toBe(3));
  });
});
