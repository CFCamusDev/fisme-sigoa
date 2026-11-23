import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  SAMPLE_OPEN_EXECUTIONS,
  SAMPLE_SESSION_DTO,
  makeSessionAttendeesResponse,
  makeSessionsResponse,
} from '../test/sessions-fixtures';
import { SessionsPage } from './sessions-page';

function setupExecutionsHandler() {
  server.use(
    http.get('*/process-executions', () =>
      HttpResponse.json({
        items: SAMPLE_OPEN_EXECUTIONS,
        page: 1,
        pageSize: 100,
        total: SAMPLE_OPEN_EXECUTIONS.length,
        totalPages: 1,
      }),
    ),
  );
}

describe('SessionsPage (HU-032, T-032-25)', () => {
  it('shows loading, empty and error states', async () => {
    setupExecutionsHandler();
    let mode: 'empty' | 'error' = 'empty';

    server.use(
      http.get('*/process-executions/:id/sessions', async () => {
        await delay(25);
        if (mode === 'error') {
          return HttpResponse.json({ message: 'Error de red' }, { status: 500 });
        }
        return HttpResponse.json(makeSessionsResponse([]));
      }),
    );

    renderWithProviders(<SessionsPage />, {
      withRouter: true,
      permissions: [{ code: 'sesion.ver', scope: 'GLOBAL' }],
    });

    expect(await screen.findByText('Cargando sesiones…')).toBeInTheDocument();
    expect(await screen.findByText('Esta ejecución aún no tiene sesiones.')).toBeInTheDocument();

    mode = 'error';
    const select = screen.getByLabelText('Ejecución');
    await userEvent.selectOptions(select, 'exec-2');

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('lists the sessions of the chosen execution with dd/mm/aaaa dates', async () => {
    setupExecutionsHandler();
    server.use(
      http.get('*/process-executions/:id/sessions', () =>
        HttpResponse.json(makeSessionsResponse([SAMPLE_SESSION_DTO])),
      ),
    );

    renderWithProviders(<SessionsPage />, {
      withRouter: true,
      permissions: [
        { code: 'sesion.ver', scope: 'GLOBAL' },
        { code: 'sesion.editar', scope: 'GLOBAL' },
      ],
    });

    expect(await screen.findByText('20/11/2026')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
    expect(screen.getByText('Virtual')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reunión' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('paginates', async () => {
    const user = userEvent.setup();
    setupExecutionsHandler();
    let requestedPage = '1';

    server.use(
      http.get('*/process-executions/:id/sessions', ({ request }) => {
        const url = new URL(request.url);
        requestedPage = url.searchParams.get('page') ?? '1';
        return HttpResponse.json(
          makeSessionsResponse([SAMPLE_SESSION_DTO], {
            total: 25,
            page: Number(requestedPage),
            pageSize: 20,
          }),
        );
      }),
    );

    renderWithProviders(<SessionsPage />, {
      withRouter: true,
      permissions: [{ code: 'sesion.ver', scope: 'GLOBAL' }],
    });

    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(requestedPage).toBe('2'));
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
  });

  it('hides “Nueva sesión” and “Editar” without sesion.editar', async () => {
    setupExecutionsHandler();
    server.use(
      http.get('*/process-executions/:id/sessions', () =>
        HttpResponse.json(makeSessionsResponse([SAMPLE_SESSION_DTO])),
      ),
    );

    renderWithProviders(<SessionsPage />, {
      withRouter: true,
      permissions: [{ code: 'sesion.ver', scope: 'GLOBAL' }],
    });

    expect(await screen.findByText('20/11/2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nueva sesión/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asistentes' })).not.toBeInTheDocument();
  });

  it('renders the title with the shared page header', async () => {
    setupExecutionsHandler();
    server.use(
      http.get('*/process-executions/:id/sessions', () =>
        HttpResponse.json(makeSessionsResponse([SAMPLE_SESSION_DTO])),
      ),
    );

    renderWithProviders(<SessionsPage />, {
      withRouter: true,
      permissions: [{ code: 'sesion.ver', scope: 'GLOBAL' }],
    });

    const heading = await screen.findByRole('heading', { level: 1, name: 'Sesiones' });
    expect(heading).toHaveClass('text-h2', 'sm:text-h1');
  });

  it('creates and edits a session in a 640px dialog', async () => {
    const user = userEvent.setup();
    setupExecutionsHandler();
    server.use(
      http.get('*/process-executions/:id/sessions', () =>
        HttpResponse.json(makeSessionsResponse([SAMPLE_SESSION_DTO])),
      ),
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 100, totalPages: 1 }),
      ),
    );

    renderWithProviders(<SessionsPage />, {
      withRouter: true,
      permissions: [
        { code: 'sesion.ver', scope: 'GLOBAL' },
        { code: 'sesion.editar', scope: 'GLOBAL' },
      ],
    });

    await screen.findByText('20/11/2026');

    await user.click(screen.getByRole('button', { name: /Nueva sesión/i }));
    const createDialog = await screen.findByRole('dialog');
    expect(createDialog).toHaveClass('w-[640px]');
    expect(createDialog).toHaveTextContent('Registrar sesión');
    await user.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    const editDialog = await screen.findByRole('dialog');
    expect(editDialog).toHaveClass('w-[640px]');
    expect(editDialog).toHaveTextContent('Editar sesión');
  });

  it('manages attendees in a 640px side panel with a fixed save bar', async () => {
    const user = userEvent.setup();
    setupExecutionsHandler();
    server.use(
      http.get('*/process-executions/:id/sessions', () =>
        HttpResponse.json(makeSessionsResponse([SAMPLE_SESSION_DTO])),
      ),
      http.get('*/sessions/:id/attendees', () => HttpResponse.json(makeSessionAttendeesResponse())),
      http.put('*/sessions/:id/attendees', () =>
        HttpResponse.json(makeSessionAttendeesResponse({ attendeeCount: 1 })),
      ),
    );

    renderWithProviders(<SessionsPage />, {
      withRouter: true,
      permissions: [
        { code: 'sesion.ver', scope: 'GLOBAL' },
        { code: 'sesion.editar', scope: 'GLOBAL' },
      ],
    });

    await screen.findByText('20/11/2026');
    await user.click(screen.getByRole('button', { name: 'Asistentes' }));

    const sheet = await screen.findByRole('dialog');
    expect(sheet).toHaveClass('w-[640px]');
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: 'Guardar asistentes' });
    expect(saveButton.parentElement).toHaveClass('shrink-0', 'border-t');

    await user.click(saveButton);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Se registró 1 asistente en la sesión.')).toBeInTheDocument();
  });

  it('keeps read-only sessions of closed executions', async () => {
    const closedExecutions = SAMPLE_OPEN_EXECUTIONS.map((item) =>
      item.id === 'exec-1' ? { ...item, status: 'CLOSED' as const } : item,
    );
    server.use(
      http.get('*/process-executions', () =>
        HttpResponse.json({
          items: closedExecutions,
          page: 1,
          pageSize: 100,
          total: closedExecutions.length,
          totalPages: 1,
        }),
      ),
      http.get('*/process-executions/:id/sessions', () =>
        HttpResponse.json(
          makeSessionsResponse([{ ...SAMPLE_SESSION_DTO, executionIds: ['exec-1'] }]),
        ),
      ),
    );

    renderWithProviders(<SessionsPage />, {
      withRouter: true,
      permissions: [
        { code: 'sesion.ver', scope: 'GLOBAL' },
        { code: 'sesion.editar', scope: 'GLOBAL' },
      ],
    });

    expect(await screen.findByText('20/11/2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Asistentes' })).toBeDisabled();
  });
});
