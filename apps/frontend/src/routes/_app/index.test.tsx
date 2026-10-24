import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { DashboardPage } from './index';

describe('DashboardPage integration with MSW', () => {
  it('renders server operational status when /health returns 200 OK', async () => {
    renderWithProviders(<DashboardPage />);

    // Inicialmente puede mostrar estado de carga
    expect(screen.getByText(/Comprobando estado del servidor/i)).toBeInTheDocument();

    // Tras responder MSW con el handler por defecto
    const successMsg = await screen.findByText(/Servicios de backend operativos \(\/health\)/i);
    expect(successMsg).toBeInTheDocument();

    const operationalBadge = screen.getByText(/Servidor operativo \(OK\)/i);
    expect(operationalBadge).toBeInTheDocument();
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
});
