import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  SAMPLE_OPEN_EXECUTIONS,
  SAMPLE_SESSION_DTO,
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
});
