import { StrictMode, useEffect } from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { QueryClientProvider } from '@tanstack/react-query';
import { PERSON_STAKEHOLDER, makeListResponse } from '../test/stakeholders-fixtures';
import { useEditStakeholder } from './use-edit-stakeholder';
import { useRegisterStakeholder } from './use-register-stakeholder';
import { useStakeholders } from './use-stakeholders';
import { useVoidStakeholder } from './use-void-stakeholder';

function StrictListProbe() {
  const query = useStakeholders({ page: 1, pageSize: 20 });
  useEffect(() => {}, [query.data]);
  return <span>{query.data?.total ?? 0}</span>;
}

describe('stakeholders hooks concurrency & StrictMode (HU-021, T-021-29)', () => {
  it('shares a single request when register, edit or void are triggered twice', async () => {
    let postCalls = 0;
    let patchCalls = 0;
    let voidCalls = 0;

    server.use(
      http.post('*/stakeholders', async () => {
        postCalls += 1;
        await delay(30);
        return HttpResponse.json(PERSON_STAKEHOLDER, { status: 201 });
      }),
      http.patch('*/stakeholders/:id', async () => {
        patchCalls += 1;
        await delay(30);
        return HttpResponse.json(PERSON_STAKEHOLDER);
      }),
      http.post('*/stakeholders/:id/void', async () => {
        voidCalls += 1;
        await delay(30);
        return HttpResponse.json({ ...PERSON_STAKEHOLDER, status: 'VOIDED' });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const reg = renderHook(() => useRegisterStakeholder(), { wrapper });
    await act(async () => {
      const [a, b] = await Promise.all([
        reg.result.current.mutateAsync({
          kind: 'PERSON',
          fullName: 'Ana Lucia Torres',
          dni: '45678912',
        }),
        reg.result.current.mutateAsync({
          kind: 'PERSON',
          fullName: 'Ana Lucia Torres',
          dni: '45678912',
        }),
      ]);
      expect(a.id).toBe(b.id);
    });
    expect(postCalls).toBe(1);

    const edit = renderHook(() => useEditStakeholder(), { wrapper });
    await act(async () => {
      const [a, b] = await Promise.all([
        edit.result.current.mutateAsync({ id: 'stk-person-1', changes: { position: 'Jefa' } }),
        edit.result.current.mutateAsync({ id: 'stk-person-1', changes: { position: 'Jefa' } }),
      ]);
      expect(a.id).toBe(b.id);
    });
    expect(patchCalls).toBe(1);

    const voidHook = renderHook(() => useVoidStakeholder(), { wrapper });
    await act(async () => {
      const [a, b] = await Promise.all([
        voidHook.result.current.mutateAsync({
          id: 'stk-person-1',
          payload: { reason: 'Motivo de anulacion concurrente valido' },
        }),
        voidHook.result.current.mutateAsync({
          id: 'stk-person-1',
          payload: { reason: 'Motivo de anulacion concurrente valido' },
        }),
      ]);
      expect(a.status).toBe('VOIDED');
      expect(b.status).toBe('VOIDED');
    });
    expect(voidCalls).toBe(1);
  });

  it('sends a single list request under StrictMode', async () => {
    let getCalls = 0;
    server.use(
      http.get('*/stakeholders', async () => {
        getCalls += 1;
        await delay(20);
        return HttpResponse.json(makeListResponse([PERSON_STAKEHOLDER]));
      }),
    );

    const queryClient = createTestQueryClient();
    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <StrictListProbe />
        </QueryClientProvider>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(getCalls).toBe(1);
    });
  });
});
