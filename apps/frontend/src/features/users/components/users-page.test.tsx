import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { UsersPage } from './users-page';

describe('UsersPage component (T-003-16)', () => {
  it('renders the header, filters, and empty list state when no users are returned', async () => {
    server.use(
      http.get('http://localhost:3000/users', () => {
        return HttpResponse.json(
          {
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
            totalPages: 0,
          },
          { status: 200 },
        );
      }),
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json(
          {
            items: [],
          },
          { status: 200 },
        );
      }),
    );

    renderWithProviders(<UsersPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Usuarios' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nuevo usuario/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/filtrar por estado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filtrar por rol/i)).toBeInTheDocument();
    expect(await screen.findByText('Aún no hay usuarios')).toBeInTheDocument();
  });
});
