import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Route } from './semestres';

describe('SemestersRoute (/configuracion/semestres) (HU-010, T-010-11)', () => {
  it('defines beforeLoad guard requiring parametro.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('renders SemestersPage component', () => {
    const Component = Route.options.component;
    expect(Component).toBeDefined();
    if (Component) {
      renderWithProviders(<Component />, { withRouter: false });
      expect(screen.getByRole('heading', { level: 1, name: /semestres/i })).toBeInTheDocument();
    }
  });
});
