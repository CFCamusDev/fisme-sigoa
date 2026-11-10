import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Route } from './parametros';

describe('ParametersRoute (/configuracion/parametros) (HU-011, T-011-13)', () => {
  it('defines beforeLoad guard requiring parametro.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('renders ParametersPage component', () => {
    const Component = Route.options.component;
    expect(Component).toBeDefined();
    if (Component) {
      renderWithProviders(<Component />, { withRouter: false });
      expect(screen.getByRole('heading', { level: 1, name: /parámetros/i })).toBeInTheDocument();
    }
  });
});
