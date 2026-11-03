import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as authFeature from '@/features/auth';
import { AppBootstrap } from './app-bootstrap';

describe('AppBootstrap component (T-002-10, CA1)', () => {
  it('renders loading state initially while restoring session', async () => {
    let resolveRestore!: (val: boolean) => void;
    const restorePromise = new Promise<boolean>((resolve) => {
      resolveRestore = resolve;
    });

    vi.spyOn(authFeature, 'restoreSession').mockReturnValue(restorePromise);

    render(
      <AppBootstrap>
        <div data-testid="app-content">Contenido de la aplicación</div>
      </AppBootstrap>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('app-content')).not.toBeInTheDocument();

    resolveRestore(true);

    await waitFor(() => {
      expect(screen.getByTestId('app-content')).toBeInTheDocument();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders children even if restoreSession resolves to false', async () => {
    vi.spyOn(authFeature, 'restoreSession').mockResolvedValue(false);

    render(
      <AppBootstrap>
        <div data-testid="app-content">Contenido público</div>
      </AppBootstrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('app-content')).toBeInTheDocument();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
