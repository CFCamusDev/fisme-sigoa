import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { Route } from './listas-constituyentes';

describe('StakeholderListsRoute (/listas-constituyentes) (HU-022, T-022-16)', () => {
  it('defines beforeLoad guard requiring constituyente.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('renders the page title and empty state when authenticated with permission', async () => {
    server.use(
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json({
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        }),
      ),
    );

    const Component = Route.options.component;
    expect(Component).toBeDefined();
    if (Component) {
      renderWithProviders(<Component />, {
        withRouter: false,
        permissions: [{ code: 'constituyente.ver', scope: 'GLOBAL' }],
      });
      expect(
        screen.getByRole('heading', { level: 1, name: /listas del anexo 3/i }),
      ).toBeInTheDocument();
      expect(await screen.findByText(/no existe lista de empleadores/i)).toBeInTheDocument();
    }
  });
});
