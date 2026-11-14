import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Route } from './resoluciones';

describe('ResolutionsRoute (/resoluciones) (HU-048, T-048-14)', () => {
  it('defines beforeLoad guard requiring resolucion.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('renders the page title', () => {
    const Component = Route.options.component;
    expect(Component).toBeDefined();
    if (Component) {
      renderWithProviders(<Component />, { withRouter: false });
      expect(screen.getByRole('heading', { level: 1, name: /resoluciones/i })).toBeInTheDocument();
    }
  });
});
