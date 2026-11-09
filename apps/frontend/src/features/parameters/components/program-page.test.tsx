import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { ProgramDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { ProgramPage } from './program-page';

const mockProgram: ProgramDto = {
  id: 'cm3programcuid1234567890',
  code: 'EPIS',
  name: 'Escuela Profesional de Ingeniería de Sistemas',
  faculty: 'Facultad de Ingeniería de Sistemas y Mecánica Eléctrica',
  updatedAt: '2026-11-09T12:00:00.000Z',
};

function createNoRetryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe('ProgramPage component (HU-009, T-009-17, CA1)', () => {
  it('renders loading state while fetching program data', async () => {
    let resolveQuery!: () => void;
    const queryPending = new Promise<void>((resolve) => {
      resolveQuery = resolve;
    });

    server.use(
      http.get('http://localhost:3000/program', async () => {
        await queryPending;
        return HttpResponse.json(mockProgram);
      }),
    );

    renderWithProviders(<ProgramPage />, {
      withRouter: false,
      queryClient: createNoRetryClient(),
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getAllByText('Cargando datos del programa...').length).toBeGreaterThan(0);

    resolveQuery();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('renders program page header and form when fetch succeeds (CA1)', async () => {
    server.use(
      http.get('http://localhost:3000/program', () => {
        return HttpResponse.json(mockProgram);
      }),
    );

    renderWithProviders(<ProgramPage />, {
      withRouter: false,
      queryClient: createNoRetryClient(),
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Programa' })).toBeInTheDocument();
    expect(
      screen.getByText('Configuración de los datos del programa institucional y facultad.'),
    ).toBeInTheDocument();

    const codeInput = await screen.findByLabelText(/código del programa/i);
    expect(codeInput).toHaveValue(mockProgram.code);
  });

  it('renders not found error state when program is 404', async () => {
    server.use(
      http.get('http://localhost:3000/program', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'No existe el programa',
            },
          },
          { status: 404 },
        );
      }),
    );

    renderWithProviders(<ProgramPage />, {
      withRouter: false,
      queryClient: createNoRetryClient(),
    });

    expect(
      await screen.findByText('No hay un programa configurado en el sistema.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('renders forbidden error state when program is 403', async () => {
    server.use(
      http.get('http://localhost:3000/program', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'No tienes permiso para consultar el programa',
            },
          },
          { status: 403 },
        );
      }),
    );

    renderWithProviders(<ProgramPage />, {
      withRouter: false,
      queryClient: createNoRetryClient(),
    });

    expect(
      await screen.findByText('No tienes permiso para consultar los datos del programa.'),
    ).toBeInTheDocument();
  });

  it('retries fetching program data when retry button is clicked', async () => {
    const user = userEvent.setup();
    let attempt = 0;

    server.use(
      http.get('http://localhost:3000/program', () => {
        attempt += 1;
        if (attempt === 1) {
          return HttpResponse.json(
            {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Fallo transitorio',
              },
            },
            { status: 500 },
          );
        }
        return HttpResponse.json(mockProgram);
      }),
    );

    renderWithProviders(<ProgramPage />, {
      withRouter: false,
      queryClient: createNoRetryClient(),
    });

    const retryBtn = await screen.findByRole('button', { name: /reintentar/i });
    expect(retryBtn).toBeInTheDocument();

    await user.click(retryBtn);

    const codeInput = await screen.findByLabelText(/código del programa/i);
    expect(codeInput).toHaveValue(mockProgram.code);
  });
});
