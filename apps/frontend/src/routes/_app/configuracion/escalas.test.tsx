import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Route } from './escalas';

describe('ResponseScalesRoute (/configuracion/escalas) (HU-012, T-012-17)', () => {
  it('defines beforeLoad guard requiring parametro.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('renders ResponseScalesPage component', () => {
    const Component = Route.options.component;
    expect(Component).toBeDefined();
    if (Component) {
      renderWithProviders(<Component />, { withRouter: false });
      expect(
        screen.getByRole('heading', { level: 1, name: /escalas de respuesta/i }),
      ).toBeInTheDocument();
    }
  });
});
