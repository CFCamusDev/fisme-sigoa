import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  SAMPLE_CATALOG_VERSIONS,
  SAMPLE_PROCESS_EXECUTION_DTO,
  SAMPLE_SEMESTERS,
  SAMPLE_SEMESTER_EXECUTION_DTO,
  makeProcessExecutionsResponse,
} from '../test/process-executions-fixtures';
import { ProcessExecutionsPage } from './process-executions-page';

describe('ProcessExecutionsPage (HU-027, T-027-21)', () => {
  it('shows loading, empty and error states', async () => {
    let failRequest = false;
    server.use(
      http.get('*/process-executions', async () => {
        await delay(20);
        if (failRequest) {
          return HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error interno' } },
            { status: 500 },
          );
        }
        return HttpResponse.json(makeProcessExecutionsResponse([]));
      }),
    );

    renderWithProviders(<ProcessExecutionsPage />, {
      permissions: [
        { code: 'ejecucion.ver', scope: 'GLOBAL' },
        { code: 'ejecucion.crear', scope: 'GLOBAL' },
      ],
    });

    expect(await screen.findByRole('status')).toHaveTextContent(/Cargando ejecuciones de proceso/i);
    expect(
      await screen.findByText(/Aún no hay ejecuciones\. Crea la primera/i),
    ).toBeInTheDocument();

    cleanup();
    failRequest = true;
    renderWithProviders(<ProcessExecutionsPage />, {
      permissions: [{ code: 'ejecucion.ver', scope: 'GLOBAL' }],
    });

    expect(
      await screen.findByText(/No se pudo completar la operación por un problema del servidor/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
  });

  it('lists executions with a status badge', async () => {
    server.use(
      http.get('*/process-executions', () =>
        HttpResponse.json(
          makeProcessExecutionsResponse([
            SAMPLE_PROCESS_EXECUTION_DTO,
            SAMPLE_SEMESTER_EXECUTION_DTO,
          ]),
        ),
      ),
    );

    renderWithProviders(<ProcessExecutionsPage />, {
      permissions: [{ code: 'ejecucion.ver', scope: 'GLOBAL' }],
    });

    expect(await screen.findByText('Medición anual de OE 2027')).toBeInTheDocument();
    expect(screen.getByText('Medición directa de AG 2027-I')).toBeInTheDocument();
    expect(screen.getByText('2027-I')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByText('Planificado')).toHaveLength(2);
  });

  it('filters by type, year and status', async () => {
    const user = userEvent.setup();
    const capturedQueries: URLSearchParams[] = [];

    server.use(
      http.get('*/process-executions', ({ request }) => {
        capturedQueries.push(new URL(request.url).searchParams);
        return HttpResponse.json(makeProcessExecutionsResponse([SAMPLE_PROCESS_EXECUTION_DTO]));
      }),
    );

    renderWithProviders(<ProcessExecutionsPage />, {
      permissions: [{ code: 'ejecucion.ver', scope: 'GLOBAL' }],
    });

    await screen.findByText('Medición anual de OE 2027');

    await user.selectOptions(screen.getByLabelText(/Proceso/i), 'P612');
    await user.type(screen.getByLabelText(/Año/i), '2027');
    await user.selectOptions(screen.getByLabelText(/Estado/i), 'PLANNED');

    await waitFor(() => {
      const last = capturedQueries.at(-1);
      expect(last?.get('type')).toBe('P612');
      expect(last?.get('year')).toBe('2027');
      expect(last?.get('status')).toBe('PLANNED');
    });
  });

  it('paginates', async () => {
    const user = userEvent.setup();
    const pagesRequested: string[] = [];

    server.use(
      http.get('*/process-executions', ({ request }) => {
        const pageParam = new URL(request.url).searchParams.get('page') ?? '1';
        pagesRequested.push(pageParam);
        return HttpResponse.json(
          makeProcessExecutionsResponse([SAMPLE_PROCESS_EXECUTION_DTO], {
            page: Number(pageParam),
            pageSize: 20,
            total: 25,
            totalPages: 2,
          }),
        );
      }),
    );

    renderWithProviders(<ProcessExecutionsPage />, {
      permissions: [{ code: 'ejecucion.ver', scope: 'GLOBAL' }],
    });

    await screen.findByText(/Página 1 de 2/i);
    await user.click(screen.getByRole('button', { name: /Siguiente/i }));

    await waitFor(() => expect(pagesRequested).toContain('2'));
  });

  it('hides “Nueva ejecución” without ejecucion.crear', async () => {
    server.use(
      http.get('*/process-executions', () => HttpResponse.json(makeProcessExecutionsResponse([]))),
    );

    renderWithProviders(<ProcessExecutionsPage />, {
      permissions: [{ code: 'ejecucion.ver', scope: 'GLOBAL' }],
    });

    await screen.findByText(/Aún no hay ejecuciones/i);
    expect(screen.queryByRole('button', { name: /Nueva ejecución/i })).not.toBeInTheDocument();
  });

  it('creates an execution from the inline panel and shows it as Planificado', async () => {
    const user = userEvent.setup();
    let created = false;

    server.use(
      http.get('*/catalog-versions', () => HttpResponse.json({ items: SAMPLE_CATALOG_VERSIONS })),
      http.get('*/semesters', () => HttpResponse.json({ items: SAMPLE_SEMESTERS })),
      http.get('*/process-executions', () =>
        HttpResponse.json(
          makeProcessExecutionsResponse(created ? [SAMPLE_PROCESS_EXECUTION_DTO] : []),
        ),
      ),
      http.post('*/process-executions', () => {
        created = true;
        return HttpResponse.json(SAMPLE_PROCESS_EXECUTION_DTO, { status: 201 });
      }),
    );

    renderWithProviders(<ProcessExecutionsPage />, {
      permissions: [
        { code: 'ejecucion.ver', scope: 'GLOBAL' },
        { code: 'ejecucion.crear', scope: 'GLOBAL' },
      ],
    });

    await screen.findByText(/Aún no hay ejecuciones/i);
    await user.click(screen.getByRole('button', { name: /Nueva ejecución/i }));

    const versionSelect = await screen.findByLabelText(/Versión de catálogo/i);
    await waitFor(() => expect((versionSelect as HTMLSelectElement).value).toBe('cv-approved-1'));

    await user.click(screen.getByRole('button', { name: /Crear ejecución/i }));

    expect(
      await screen.findByText(
        /Ejecución «Medición anual de OE 2027» creada en estado Planificado/i,
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('Medición anual de OE 2027')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Planificado')).toBeInTheDocument();
  });
});
