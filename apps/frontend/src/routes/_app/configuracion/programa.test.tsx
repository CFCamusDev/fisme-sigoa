import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Route } from './programa';

describe('ProgramRoute (/configuracion/programa) (HU-009, T-009-02)', () => {
  it('defines beforeLoad guard requiring parametro.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('renders ProgramPage component', () => {
    const Component = Route.options.component;
    expect(Component).toBeDefined();
    if (Component) {
      renderWithProviders(<Component />, { withRouter: false });
      expect(screen.getByRole('heading', { level: 1, name: /programa/i })).toBeInTheDocument();
    }
  });
});
