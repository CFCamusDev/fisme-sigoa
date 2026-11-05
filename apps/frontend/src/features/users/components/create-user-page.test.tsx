import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { CreateUserPage } from './create-user-page';

describe('CreateUserPage component (T-003-27)', () => {
  it('renders page header with institutional title and description', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json({ items: [] });
      }),
    );

    renderWithProviders(<CreateUserPage />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nuevo usuario' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Registra un nuevo usuario en la plataforma. Se le enviará un correo para activar su cuenta.',
      ),
    ).toBeInTheDocument();

    // Contiene el botón de acción del formulario
    expect(screen.getByRole('button', { name: /crear usuario/i })).toBeInTheDocument();
  });
});
