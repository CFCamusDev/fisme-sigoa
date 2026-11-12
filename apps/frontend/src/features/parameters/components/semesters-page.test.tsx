import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { SemestersPage } from './semesters-page';

describe('SemestersPage Component (HU-010, T-010-18)', () => {
  it('renders loading state while semesters data is fetching', async () => {
    let resolveSemesters!: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolveSemesters = resolve;
    });

    server.use(
      http.get('http://localhost:3000/semesters', async () => {
        await pendingPromise;
        return HttpResponse.json({ items: [] });
      }),
    );

    renderWithProviders(<SemestersPage />, { withRouter: false });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getAllByText(/cargando semestres/i).length).toBeGreaterThan(0);

    resolveSemesters();

    expect(await screen.findByRole('heading', { level: 1, name: 'Semestres' })).toBeInTheDocument();
  });

  it('renders 403 access denied error state when user lacks parametro.ver', async () => {
    server.use(
      http.get('http://localhost:3000/semesters', () => {
        return HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Acceso denegado' } },
          { status: 403 },
        );
      }),
    );

    renderWithProviders(<SemestersPage />, { withRouter: false });

    expect(
      await screen.findByRole('heading', { level: 3, name: /acceso denegado/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no tienes permiso para consultar los semestres/i)).toBeInTheDocument();
  });

  it('renders generic error state on 500 and allows retry', async () => {
    let callCount = 0;
    server.use(
      http.get('http://localhost:3000/semesters', () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Fallo temporal en la base de datos' } },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          items: [
            {
              id: 'sem-retry-01',
              code: '2026-I',
              startDate: '2026-03-15',
              endDate: '2026-07-15',
              createdAt: '2026-03-01T00:00:00.000Z',
              updatedAt: '2026-03-01T00:00:00.000Z',
            },
          ],
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<SemestersPage />, { withRouter: false });

    expect(
      await screen.findByRole('heading', { level: 3, name: /error al cargar los semestres/i }),
    ).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /reintentar/i });
    await user.click(retryButton);

    expect(await screen.findByText('2026-I')).toBeInTheDocument();
  });

  it('renders form and table with data for authorized user with parametro.editar', async () => {
    server.use(
      http.get('http://localhost:3000/semesters', () => {
        return HttpResponse.json({
          items: [
            {
              id: 'sem-auth-01',
              code: '2026-I',
              startDate: '2026-03-15',
              endDate: '2026-07-15',
              createdAt: '2026-03-01T00:00:00.000Z',
              updatedAt: '2026-03-01T00:00:00.000Z',
            },
          ],
        });
      }),
    );

    renderWithProviders(<SemestersPage />, {
      withRouter: false,
      permissions: [
        { code: 'parametro.ver', scope: 'GLOBAL' },
        { code: 'parametro.editar', scope: 'GLOBAL' },
      ],
    });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Registrar nuevo semestre' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /registrar semestre/i })).toBeInTheDocument();
    expect(screen.getByText('2026-I')).toBeInTheDocument();
  });

  it('renders read-only notice in form section when user lacks parametro.editar', async () => {
    server.use(
      http.get('http://localhost:3000/semesters', () => {
        return HttpResponse.json({
          items: [],
        });
      }),
    );

    renderWithProviders(<SemestersPage />, {
      withRouter: false,
      permissions: [{ code: 'parametro.ver', scope: 'GLOBAL' }],
    });

    expect(
      await screen.findByText(/solo lectura: no tienes permiso para registrar semestres/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar semestre/i })).not.toBeInTheDocument();
  });
});
