import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HealthStatus } from './health-status';

describe('HealthStatus component', () => {
  it('renders loading state with role="status" and accessible description', () => {
    render(<HealthStatus status="loading" />);

    const statusElement = screen.getByRole('status');
    expect(statusElement).toBeInTheDocument();
    expect(statusElement).toHaveTextContent(/Comprobando estado del servidor/i);
  });

  it('renders ok state with uptime and role="status"', () => {
    render(
      <HealthStatus
        status="ok"
        message="Servicios operativos"
        uptime={3600}
        timestamp="2026-10-23T20:00:00Z"
      />,
    );

    const statusElement = screen.getByRole('status');
    expect(statusElement).toBeInTheDocument();
    expect(statusElement).toHaveTextContent(/Servidor operativo \(OK\)/i);
    expect(statusElement).toHaveTextContent(/Tiempo activo: 3600s/i);
  });

  it('renders error state with role="alert" for immediate screen reader announcement', () => {
    render(
      <HealthStatus status="error" message="No se pudo establecer conexión con el backend." />,
    );

    const alertElement = screen.getByRole('alert');
    expect(alertElement).toBeInTheDocument();
    expect(alertElement).toHaveTextContent(/Servidor no disponible o con errores/i);
    expect(alertElement).toHaveTextContent(/No se pudo establecer conexión con el backend/i);
  });
});
