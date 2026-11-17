import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import {
  EMPLOYER_LIST_DTO,
  EMPLOYER_LIST_MEMBER,
  makeStakeholderListsResponse,
} from '../test/stakeholder-lists-fixtures';
import { useAddStakeholderListMember } from './use-add-stakeholder-list-member';
import { useCopyStakeholderList } from './use-copy-stakeholder-list';
import { useCreateStakeholderList } from './use-create-stakeholder-list';
import { useStakeholderLists } from './use-stakeholder-lists';

describe('stakeholder lists hooks concurrency & invalidation (HU-022, T-022-28)', () => {
  it('shares one request when create, add and copy are triggered several times at once', async () => {
    let createCalls = 0;
    let addCalls = 0;
    let copyCalls = 0;

    server.use(
      http.post('*/stakeholder-lists', async () => {
        createCalls += 1;
        await delay(30);
        return HttpResponse.json(EMPLOYER_LIST_DTO, { status: 201 });
      }),
      http.post('*/stakeholder-lists/:id/members', async () => {
        addCalls += 1;
        await delay(30);
        return HttpResponse.json(EMPLOYER_LIST_MEMBER, { status: 201 });
      }),
      http.post('*/stakeholder-lists/:id/copy', async () => {
        copyCalls += 1;
        await delay(30);
        return HttpResponse.json(
          { list: { ...EMPLOYER_LIST_DTO, year: 2028 }, skipped: [] },
          { status: 201 },
        );
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const createHook = renderHook(() => useCreateStakeholderList(), { wrapper });
    await act(async () => {
      const [a, b] = await Promise.all([
        createHook.result.current.mutateAsync({ type: 'EMPLOYER', year: 2027 }),
        createHook.result.current.mutateAsync({ type: 'EMPLOYER', year: 2027 }),
      ]);
      expect(a).toEqual(b);
    });
    expect(createCalls).toBe(1);

    const addHook = renderHook(() => useAddStakeholderListMember(), { wrapper });
    await act(async () => {
      const [a, b] = await Promise.all([
        addHook.result.current.mutateAsync({
          listId: 'list-emp-2027',
          stakeholderId: 'stk-inst-1',
          representative: 'Carlos Mendoza',
        }),
        addHook.result.current.mutateAsync({
          listId: 'list-emp-2027',
          stakeholderId: 'stk-inst-1',
          representative: 'Carlos Mendoza',
        }),
      ]);
      expect(a).toEqual(b);
    });
    expect(addCalls).toBe(1);

    const copyHook = renderHook(() => useCopyStakeholderList(), { wrapper });
    await act(async () => {
      const [a, b] = await Promise.all([
        copyHook.result.current.mutateAsync({ sourceListId: 'list-emp-2027', year: 2028 }),
        copyHook.result.current.mutateAsync({ sourceListId: 'list-emp-2027', year: 2028 }),
      ]);
      expect(a).toEqual(b);
    });
    expect(copyCalls).toBe(1);
  });

  it('invalidates the lists after success and after a 409', async () => {
    let listCalls = 0;
    let shouldConflict = false;

    server.use(
      http.get('*/stakeholder-lists', () => {
        listCalls += 1;
        return HttpResponse.json(makeStakeholderListsResponse([EMPLOYER_LIST_DTO]));
      }),
      http.post('*/stakeholder-lists', () => {
        if (shouldConflict) {
          return HttpResponse.json(
            { error: { code: 'CONFLICT', message: 'Ya existe la lista' } },
            { status: 409 },
          );
        }
        return HttpResponse.json(EMPLOYER_LIST_DTO, { status: 201 });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useStakeholderLists({ type: 'EMPLOYER', year: 2027 }), { wrapper });
    await waitFor(() => expect(listCalls).toBe(1));

    const createHook = renderHook(() => useCreateStakeholderList(), { wrapper });
    await act(async () => {
      await createHook.result.current.mutateAsync({ type: 'EMPLOYER', year: 2027 });
    });
    await waitFor(() => expect(listCalls).toBe(2));

    shouldConflict = true;
    await act(async () => {
      await expect(
        createHook.result.current.mutateAsync({ type: 'EMPLOYER', year: 2027 }),
      ).rejects.toThrow();
    });
    await waitFor(() => expect(listCalls).toBe(3));
  });
});
