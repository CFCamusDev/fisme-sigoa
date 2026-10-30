import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Route } from './_auth';

describe('_auth layout', () => {
  it('renders skip link, institutional logo and branding in aside panel', async () => {
    const Component = Route.options.component;
    if (!Component) {
      throw new Error('Component not defined on Route');
    }

    renderWithProviders(<Component />);

    const skipLink = await screen.findByText('Saltar al contenido principal');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');

    expect(screen.getByText('FISME-SIGOA')).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toHaveClass('brand-motif');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });
});
