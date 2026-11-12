import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Route } from './versiones';

describe('CatalogVersionsRoute (/catalogo/versiones) (HU-013, T-013-02)', () => {
  it('defines beforeLoad guard requiring catalogo.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('renders the page title', () => {
    const Component = Route.options.component;
    expect(Component).toBeDefined();
    if (Component) {
      renderWithProviders(<Component />, { withRouter: false });
      expect(
        screen.getByRole('heading', { level: 1, name: /versiones del catálogo/i }),
      ).toBeInTheDocument();
    }
  });
});
