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

  it('renders navigation item "Usuarios" linking to /usuarios (T-003-16)', async () => {
    renderWithProviders(
      <AppLayout>
        <p>Dashboard</p>
      </AppLayout>,
    );

    const usersLink = await screen.findByRole('link', { name: /Usuarios/i });
    expect(usersLink).toBeInTheDocument();
    expect(usersLink).toHaveAttribute('href', '/usuarios');
  });

  it('renders navigation item "Roles" linking to /roles (HU-006, T-006-21)', async () => {
    renderWithProviders(
      <AppLayout>
        <p>Dashboard</p>
      </AppLayout>,
    );

    const rolesLink = await screen.findByRole('link', { name: /Roles/i });
    expect(rolesLink).toBeInTheDocument();
    expect(rolesLink).toHaveAttribute('href', '/roles');
  });

  it('renders navigation item "Programa" linking to /configuracion/programa (HU-009, T-009-12)', async () => {
    renderWithProviders(
      <AppLayout>
        <p>Dashboard</p>
      </AppLayout>,
    );

    const programLink = await screen.findByRole('link', { name: /Programa/i });
    expect(programLink).toBeInTheDocument();
    expect(programLink).toHaveAttribute('href', '/configuracion/programa');
  });

  it('renders navigation item "Semestres" linking to /configuracion/semestres (HU-010, T-010-11)', async () => {
    renderWithProviders(
      <AppLayout>
        <p>Dashboard</p>
      </AppLayout>,
    );

    const semestersLink = await screen.findByRole('link', { name: /Semestres/i });
    expect(semestersLink).toBeInTheDocument();
    expect(semestersLink).toHaveAttribute('href', '/configuracion/semestres');
  });

  it('renders navigation item "Parámetros" linking to /configuracion/parametros (HU-011, T-011-13)', async () => {
    renderWithProviders(
      <AppLayout>
        <p>Dashboard</p>
      </AppLayout>,
    );

    const parametersLink = await screen.findByRole('link', { name: /Parámetros/i });
    expect(parametersLink).toBeInTheDocument();
    expect(parametersLink).toHaveAttribute('href', '/configuracion/parametros');
  });

  it('renders navigation item "Escalas" linking to /configuracion/escalas (HU-012, T-012-17)', async () => {
    renderWithProviders(
      <AppLayout>
        <p>Dashboard</p>
      </AppLayout>,
    );

    const scalesLink = await screen.findByRole('link', { name: /Escalas/i });
    expect(scalesLink).toBeInTheDocument();
    expect(scalesLink).toHaveAttribute('href', '/configuracion/escalas');
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

  it('renders institutional logo in topbar and supports optional userMenu', async () => {
    renderWithProviders(
      <AppLayout userMenu={<button type="button">Menú Usuario</button>}>
        <p>Contenido</p>
      </AppLayout>,
    );

    const banner = await screen.findByRole('banner');
    expect(banner).toBeInTheDocument();

    const logoImg = screen.getByAltText(
      /Universidad Nacional Toribio Rodríguez de Mendoza de Amazonas/i,
    );
    expect(logoImg).toBeInTheDocument();
    expect(screen.getByText('Menú Usuario')).toBeInTheDocument();
  });

  it('marks the active navigation item with aria-current="page"', async () => {
    renderWithProviders(
      <AppLayout>
        <p>Contenido</p>
      </AppLayout>,
    );

    const activeLink = await screen.findByRole('link', { name: /Panel/i });
    expect(activeLink).toHaveAttribute('aria-current', 'page');
  });

  it('closes mobile sidebar when Escape key is pressed', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AppLayout>
        <p>Contenido</p>
      </AppLayout>,
    );

    const menuToggle = await screen.findByRole('button', {
      name: /Abrir menú de navegación/i,
    });
    await user.click(menuToggle);
    expect(menuToggle).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
    expect(menuToggle).toHaveFocus();
  });

  it('follows accessible tab order: skip link first, then menu toggle, then nav items', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AppLayout>
        <button type="button">Contenido acción</button>
      </AppLayout>,
    );

    // 1. Skip link
    await user.tab();
    const skipLink = screen.getByRole('link', { name: /Saltar al contenido principal/i });
    expect(skipLink).toHaveFocus();

    // 2. Menu toggle button
    await user.tab();
    const menuToggle = screen.getByRole('button', { name: /Abrir menú de navegación/i });
    expect(menuToggle).toHaveFocus();

    // 3. Primer enlace de navegación
    await user.tab();
    const firstNavLink = screen.getByRole('link', { name: /Panel/i });
    expect(firstNavLink).toHaveFocus();
  });

  it('moves focus to main#main-content when activating skip link with Enter key', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AppLayout>
        <h1>Contenido Principal</h1>
      </AppLayout>,
    );

    await user.tab();
    const skipLink = screen.getByRole('link', { name: /Saltar al contenido principal/i });
    expect(skipLink).toHaveFocus();

    await user.keyboard('{Enter}');
    const main = screen.getByRole('main');
    expect(main).toHaveFocus();
  });
});
