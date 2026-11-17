import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { useConfirmStakeholderImport } from './use-confirm-stakeholder-import';
import { useDownloadStakeholderImportTemplate } from './use-download-stakeholder-import-template';
import { usePreviewStakeholderImport } from './use-preview-stakeholder-import';

describe('stakeholder import hooks concurrency & invalidation (HU-023, T-023-10, T-023-18)', () => {
  it('shares one confirm request among simultaneous calls', async () => {
    let confirmCalls = 0;
    server.use(
      http.post('*/stakeholder-lists/:id/import/confirm', async () => {
        confirmCalls += 1;
        await delay(30);
        return HttpResponse.json(
          {
            importId: 'imp-1',
            listId: 'list-1',
            totals: { created: 1, reused: 0, added: 1, alreadyInList: 0, rejected: 0 },
            rejectedRows: [],
          },
          { status: 201 },
        );
      }),
    );

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useConfirmStakeholderImport(), { wrapper });
    const file = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'docentes.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      lastModified: 1700000000000,
    });

    await act(async () => {
      await Promise.all([
        result.current.mutateAsync({ listId: 'list-1', file }),
        result.current.mutateAsync({ listId: 'list-1', file }),
      ]);
    });

    expect(confirmCalls).toBe(1);
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stakeholder-lists'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stakeholders'] });
    });
  });

  it('shares one preview and template request among simultaneous calls', async () => {
    let previewCalls = 0;
    let templateCalls = 0;

    server.use(
      http.post('*/stakeholder-lists/:id/import/preview', async () => {
        previewCalls += 1;
        await delay(30);
        return HttpResponse.json(
          {
            listId: 'list-1',
            listType: 'TEACHER',
            totals: { total: 1, new: 1, existing: 0, alreadyInList: 0, invalid: 0 },
            rows: [
              {
                rowNumber: 2,
                status: 'NEW',
                document: '71234567',
                fullName: 'Mario Quispe',
                errors: [],
              },
            ],
          },
          { status: 200 },
        );
      }),
      http.get('*/stakeholder-lists/excel-template', async () => {
        templateCalls += 1;
        await delay(30);
        return new HttpResponse(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="plantilla-teacher.xlsx"',
          },
        });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result: previewHook } = renderHook(() => usePreviewStakeholderImport(), { wrapper });
    const { result: templateHook } = renderHook(() => useDownloadStakeholderImportTemplate(), {
      wrapper,
    });

    const file = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'docentes.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      lastModified: 1700000000001,
    });

    await act(async () => {
      const [p1, p2, t1, t2] = await Promise.all([
        previewHook.current.mutateAsync({ listId: 'list-1', file }),
        previewHook.current.mutateAsync({ listId: 'list-1', file }),
        templateHook.current.mutateAsync('TEACHER'),
        templateHook.current.mutateAsync('TEACHER'),
      ]);
      expect(p1.totals.new).toBe(1);
      expect(p2.totals.new).toBe(1);
      expect(t1.fileName).toBe('plantilla-teacher.xlsx');
      expect(t2.fileName).toBe('plantilla-teacher.xlsx');
    });

    expect(previewCalls).toBe(1);
    expect(templateCalls).toBe(1);
  });
});
