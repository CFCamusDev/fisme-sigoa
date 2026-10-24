import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AppLayout } from './app-layout';

describe('AppLayout Component', () => {
  it('renders skip-to-content accessible link pointing to #main-content', async () => {
    renderWithProviders(
      <AppLayout>
        <p>Contenido de prueba</p>
      </AppLayout>,
    );

    const skipLink = await screen.findByRole('link', { name: /Saltar al contenido principal/i });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('renders semantic landmarks header, nav, and main with id="main-content"', async () => {
    renderWithProviders(
      <AppLayout>
        <h1>Título principal</h1>
      </AppLayout>,
    );

    const header = await screen.findByRole('banner');
    expect(header).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: /Navegación principal/i });
    expect(nav).toBeInTheDocument();

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('id', 'main-content');
    expect(screen.getByText('Título principal')).toBeInTheDocument();
  });

  it('renders navigation item "Panel" linking to root', async () => {
    renderWithProviders(
      <AppLayout>
        <p>Dashboard</p>
      </AppLayout>,
    );

    const panelLink = await screen.findByRole('link', { name: /Panel/i });
    expect(panelLink).toBeInTheDocument();
    expect(panelLink).toHaveAttribute('href', '/');
  });

  it('controls mobile sidebar visibility with accessible aria-expanded button', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AppLayout>
        <p>Contenido</p>
      </AppLayout>,
    );

    const menuToggle = await screen.findByRole('button', { name: /Abrir menú de navegación/i });
    expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
    expect(menuToggle).toHaveAttribute('aria-controls', 'app-sidebar');

    await user.click(menuToggle);

    expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Cerrar menú de navegación/i })).toBeInTheDocument();

    await user.click(menuToggle);
    expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
  });
});
