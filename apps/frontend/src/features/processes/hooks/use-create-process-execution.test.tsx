import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import {
  SAMPLE_PROCESS_EXECUTION_DTO,
  makeProcessExecutionsResponse,
} from '../test/process-executions-fixtures';
import { useCreateProcessExecution } from './use-create-process-execution';
import { useProcessExecutions } from './use-process-executions';

describe('useCreateProcessExecution (HU-027, T-027-12)', () => {
  it('shares one request among simultaneous identical submissions', async () => {
    let postCalls = 0;
    server.use(
      http.post('*/process-executions', async () => {
        postCalls += 1;
        await delay(30);
        return HttpResponse.json(SAMPLE_PROCESS_EXECUTION_DTO, { status: 201 });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StrictMode>
    );

    const { result } = renderHook(() => useCreateProcessExecution(), { wrapper });

    await act(async () => {
      const [first, second] = await Promise.all([
        result.current.mutateAsync({
          type: 'P612',
          year: 2027,
          catalogVersionId: 'cv-approved-1',
        }),
        result.current.mutateAsync({
          type: 'P612',
          year: 2027,
          catalogVersionId: 'cv-approved-1',
        }),
      ]);
      expect(first).toEqual(second);
    });

    expect(postCalls).toBe(1);
  });

  it('invalidates the list on success and on 409', async () => {
    let listCalls = 0;
    let shouldConflict = false;

    server.use(
      http.get('*/process-executions', () => {
        listCalls += 1;
        return HttpResponse.json(makeProcessExecutionsResponse([SAMPLE_PROCESS_EXECUTION_DTO]));
      }),
      http.post('*/process-executions', () => {
        if (shouldConflict) {
          return HttpResponse.json(
            { error: { code: 'CONFLICT', message: 'Ya existe una ejecución activa' } },
            { status: 409 },
          );
        }
        return HttpResponse.json(SAMPLE_PROCESS_EXECUTION_DTO, { status: 201 });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useProcessExecutions({ page: 1, pageSize: 20 }), { wrapper });
    await waitFor(() => expect(listCalls).toBe(1));

    const mutation = renderHook(() => useCreateProcessExecution(), { wrapper });
    await act(async () => {
      await mutation.result.current.mutateAsync({
        type: 'P612',
        year: 2027,
        catalogVersionId: 'cv-approved-1',
      });
    });
    await waitFor(() => expect(listCalls).toBe(2));

    shouldConflict = true;
    await act(async () => {
      await expect(
        mutation.result.current.mutateAsync({
          type: 'P612',
          year: 2027,
          catalogVersionId: 'cv-approved-1',
        }),
      ).rejects.toThrow();
    });
    await waitFor(() => expect(listCalls).toBe(3));
  });
});
