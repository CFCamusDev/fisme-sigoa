import React from 'react';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/stores/auth.store';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { DashboardPage } from './index';

describe('DashboardPage integration with MSW', () => {
  it('renders server operational status when /health returns 200 OK', async () => {
    renderWithProviders(<DashboardPage />);

    const successMsg = await screen.findByText(/Servicios de backend operativos \(\/health\)/i);
    expect(successMsg).toBeInTheDocument();

    const operationalBadge = screen.getByText(/Servidor operativo \(OK\)/i);
    expect(operationalBadge).toBeInTheDocument();
    expect(screen.getByText(/Última comprobación:/i)).toBeInTheDocument();
  });

  it('renders error alert when backend responds with 500 Internal Error', async () => {
    server.use(
      http.get('http://localhost:3000/health', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Error interno simulado del servidor',
            },
          },
          { status: 500 },
        );
      }),
    );

    renderWithProviders(<DashboardPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/Error interno simulado del servidor/i);
  });

  it('shows quick links by permission and empty message without permissions', async () => {
    const { unmount } = renderWithProviders(<DashboardPage />, {
      permissions: [{ code: 'usuario.ver', scope: 'GLOBAL' }],
    });

    expect(await screen.findByRole('link', { name: 'Usuarios' })).toHaveAttribute(
      'href',
      '/usuarios',
    );
    expect(screen.queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Panel' })).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<DashboardPage />, {
      permissions: [],
    });

    expect(
      await screen.findByText(
        'Tu rol aún no tiene módulos asignados. Pide acceso al Administrador.',
      ),
    ).toBeInTheDocument();
  });

  it('lists the running executions with a link to the board', async () => {
    server.use(
      http.get('http://localhost:3000/process-executions', () =>
        HttpResponse.json({
          items: [
            {
              id: 'exec-1',
              name: 'Medición anual 2027',
              processType: 'MEASURE_EO_ANNUAL',
              period: '2027',
              status: 'IN_PROGRESS',
              catalogVersionId: 'cat-1',
              createdAt: '2026-11-20T10:00:00.000Z',
              updatedAt: '2026-11-20T10:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 5,
        }),
      ),
    );

    renderWithProviders(<DashboardPage />, {
      permissions: [{ code: 'ejecucion.ver', scope: 'GLOBAL' }],
    });

    expect(await screen.findByText('Medición anual 2027')).toBeInTheDocument();
    expect(screen.getByText('En ejecución')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir tablero' })).toHaveAttribute(
      'href',
      '/ejecuciones/exec-1',
    );
  });

  it('shows an empty state without running executions', async () => {
    renderWithProviders(<DashboardPage />, {
      permissions: [{ code: 'ejecucion.ver', scope: 'GLOBAL' }],
    });

    expect(await screen.findByText('No hay ejecuciones en curso')).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    server.use(
      http.get('http://localhost:3000/process-executions', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Error al consultar' } },
          { status: 500 },
        ),
      ),
    );

    renderWithProviders(<DashboardPage />, {
      permissions: [{ code: 'ejecucion.ver', scope: 'GLOBAL' }],
    });

    expect(await screen.findByText('No se pudieron cargar las ejecuciones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
  });

  it('shares a single permissions request across home and sidebar under React.StrictMode', async () => {
    useAuthStore.getState().setAuthSession({
      accessToken: 'strict-home-token',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      user: {
        id: 'usr-home-strict',
        names: 'Admin',
        firstSurname: 'Home',
        secondSurname: null,
        email: 'admin.home@untrm.edu.pe',
      },
    });

    let permissionsRequestCount = 0;
    server.use(
      http.get('http://localhost:3000/me/permissions', () => {
        permissionsRequestCount += 1;
        return HttpResponse.json({
          permissions: [{ code: 'usuario.ver', scope: 'GLOBAL' }],
        });
      }),
    );

    renderWithProviders(
      <React.StrictMode>
        <div>
          <Sidebar isOpen={false} onClose={vi.fn()} />
          <DashboardPage />
        </div>
      </React.StrictMode>,
      { permissions: null },
    );

    expect(await screen.findByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
    expect(permissionsRequestCount).toBe(1);
  });
});
