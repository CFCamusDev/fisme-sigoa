import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert, AlertDescription, AlertTitle } from './alert';

describe('Alert component', () => {
  it('renders default alert with role="status"', () => {
    render(
      <Alert>
        <AlertTitle>Información</AlertTitle>
        <AlertDescription>Detalle informativo</AlertDescription>
      </Alert>,
    );

    const alert = screen.getByRole('status');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('Información')).toBeInTheDocument();
    expect(screen.getByText('Detalle informativo')).toBeInTheDocument();
    expect(alert).toHaveClass('border-border', 'bg-card');
  });

  it('renders danger variant with role="alert" automatically', () => {
    render(
      <Alert variant="danger">
        <AlertTitle>Error crítico</AlertTitle>
        <AlertDescription>No se pudo conectar</AlertDescription>
      </Alert>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('bg-danger-soft', 'text-danger');
  });

  it('renders warning variant with role="status" and warning tokens', () => {
    render(
      <Alert variant="warning">
        <AlertTitle>Advertencia</AlertTitle>
        <AlertDescription>Faltan datos</AlertDescription>
      </Alert>,
    );

    const alert = screen.getByRole('status');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('bg-warning-soft', 'text-warning');
  });
});
