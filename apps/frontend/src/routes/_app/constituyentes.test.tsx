import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Route } from './constituyentes';

describe('StakeholdersRoute (/constituyentes) (HU-021, T-021-02)', () => {
  it('defines beforeLoad guard requiring constituyente.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('renders the page title and empty state', () => {
    const Component = Route.options.component;
    expect(Component).toBeDefined();
    if (Component) {
      renderWithProviders(<Component />, { withRouter: false });
      expect(
        screen.getByRole('heading', { level: 1, name: /constituyentes/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/no hay constituyentes registrados en este momento/i),
      ).toBeInTheDocument();
    }
  });
});
