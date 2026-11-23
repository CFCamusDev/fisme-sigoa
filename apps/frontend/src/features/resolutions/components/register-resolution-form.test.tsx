import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogVersionDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { buildResolution } from '@/test/resolution-fixtures';
import { RegisterResolutionForm } from './register-resolution-form';

const VERSIONS: readonly CatalogVersionDto[] = [
  {
    id: 'ver-1',
    programId: 'prog-1',
    number: 2,
    status: 'IN_VALIDATION',
    basedOnVersionId: null,
    objectiveCount: 4,
    attributeCount: 12,
    createdAt: '2026-11-01T00:00:00.000Z',
  },
];

describe('RegisterResolutionForm (HU-081, T-081-21)', () => {
  it('marks number and catalog version for each duplicate', async () => {
    const user = userEvent.setup();
    let mode: 'number' | 'version' = 'number';

    server.use(
      http.post('*/resolutions', () => {
        if (mode === 'number') {
          return HttpResponse.json(
            {
              error: {
                code: 'CONFLICT',
                message: 'Ya existe una resolución con ese número para este tipo.',
                details: [
                  {
                    path: 'number',
                    message: 'Ya existe una resolución con ese número para este tipo.',
                  },
                ],
              },
            },
            { status: 409 },
          );
        }
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Esta versión del catálogo ya tiene una resolución de ese tipo.',
              details: [
                {
                  path: 'catalogVersionId',
                  message: 'Esta versión del catálogo ya tiene una resolución de ese tipo.',
                },
              ],
            },
          },
          { status: 409 },
        );
      }),
    );

    renderWithProviders(
      <RegisterResolutionForm
        versions={VERSIONS}
        versionsLoading={false}
        versionsDenied={false}
        onCancel={vi.fn()}
        onRegistered={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Número de resolución'), 'RD-012/2027');
    await user.type(screen.getByLabelText('Fecha de la resolución'), '2026-11-10');
    await user.click(screen.getByRole('button', { name: 'Registrar resolución' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Número de resolución')).toHaveAttribute('aria-invalid', 'true');
    });
    expect(screen.getByLabelText('Número de resolución')).toHaveAccessibleDescription(
      'Ya existe una resolución con ese número para este tipo.',
    );

    mode = 'version';
    await user.click(screen.getByRole('button', { name: 'Registrar resolución' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Versión del catálogo')).toHaveAttribute('aria-invalid', 'true');
    });
    expect(screen.getByLabelText('Versión del catálogo')).toHaveAccessibleDescription(
      'Esta versión del catálogo ya tiene una resolución de ese tipo.',
    );
  });

  it('shows the empty date message', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <RegisterResolutionForm
        versions={VERSIONS}
        versionsLoading={false}
        versionsDenied={false}
        onCancel={vi.fn()}
        onRegistered={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Número de resolución'), 'RD-012/2027');
    await user.click(screen.getByRole('button', { name: 'Registrar resolución' }));

    const dateInput = screen.getByLabelText('Fecha de la resolución');
    await waitFor(() => {
      expect(dateInput).toHaveAttribute('aria-invalid', 'true');
    });
    expect(screen.getByText('Ingresa la fecha de la resolución.')).toBeInTheDocument();
  });

  it('sends a single request on double submit', async () => {
    const user = userEvent.setup();
    const onRegistered = vi.fn();
    let requestCount = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    server.use(
      http.post('*/resolutions', async () => {
        requestCount += 1;
        await gate;
        return HttpResponse.json(buildResolution({ id: 'res-new' }), { status: 201 });
      }),
    );

    renderWithProviders(
      <RegisterResolutionForm
        versions={VERSIONS}
        versionsLoading={false}
        versionsDenied={false}
        onCancel={vi.fn()}
        onRegistered={onRegistered}
      />,
    );

    await user.type(screen.getByLabelText('Número de resolución'), 'RD-012/2027');
    await user.type(screen.getByLabelText('Fecha de la resolución'), '2026-11-10');

    const submitButton = screen.getByRole('button', { name: 'Registrar resolución' });
    await user.dblClick(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Registrando…' })).toBeDisabled();
    });
    expect(requestCount).toBe(1);

    release();

    await waitFor(() => {
      expect(onRegistered).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Registrar resolución' })).toBeEnabled();
    });
  });
});
