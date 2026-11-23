import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  SAMPLE_CATALOG_VERSIONS,
  SAMPLE_PROCESS_EXECUTION_DTO,
  SAMPLE_SEMESTERS,
} from '../test/process-executions-fixtures';
import { ProcessExecutionForm } from './process-execution-form';

function setupCatalogAndSemesters(
  versions = SAMPLE_CATALOG_VERSIONS,
  semesters = SAMPLE_SEMESTERS,
) {
  server.use(
    http.get('*/catalog-versions', () => HttpResponse.json({ items: versions })),
    http.get('*/semesters', () => HttpResponse.json({ items: semesters })),
  );
}

describe('ProcessExecutionForm (HU-027, T-027-21)', () => {
  it('creates the annual OE measurement 2027', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;
    setupCatalogAndSemesters();
    server.use(
      http.post('*/process-executions', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(SAMPLE_PROCESS_EXECUTION_DTO, { status: 201 });
      }),
    );

    const onCreated = vi.fn();
    renderWithProviders(<ProcessExecutionForm onCreated={onCreated} onCancel={vi.fn()} />, {
      withRouter: false,
    });

    const typeSelect = screen.getByLabelText(/^Proceso$/i);
    await user.selectOptions(typeSelect, 'P612');

    const versionSelect = await screen.findByLabelText(/Versión de catálogo/i);
    await waitFor(() => expect((versionSelect as HTMLSelectElement).value).toBe('cv-approved-1'));

    const yearInput = screen.getByLabelText(/Año/i);
    await user.clear(yearInput);
    await user.type(yearInput, '2027');

    await user.click(screen.getByRole('button', { name: /Crear ejecución/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(SAMPLE_PROCESS_EXECUTION_DTO));
    expect(capturedBody).toEqual({
      type: 'P612',
      year: 2027,
      catalogVersionId: 'cv-approved-1',
    });
  });

  it('offers only the version under validation for a validation process', async () => {
    const user = userEvent.setup();
    setupCatalogAndSemesters();

    renderWithProviders(<ProcessExecutionForm onCreated={vi.fn()} onCancel={vi.fn()} />, {
      withRouter: false,
    });

    const typeSelect = screen.getByLabelText(/^Proceso$/i);
    const versionSelect = await screen.findByLabelText(/Versión de catálogo/i);

    await user.selectOptions(typeSelect, 'P612');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /v1 · Vigente/i })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /v2 · En validación/i })).not.toBeInTheDocument();
    });

    for (const validationType of ['P611', 'P613', 'P621'] as const) {
      await user.selectOptions(typeSelect, validationType);
      await waitFor(() => {
        expect(screen.getByRole('option', { name: /v2 · En validación/i })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /v1 · Vigente/i })).not.toBeInTheDocument();
        expect((versionSelect as HTMLSelectElement).value).toBe('cv-validation-2');
      });
    }

    for (const measurementType of ['P612', 'P622', 'P623'] as const) {
      await user.selectOptions(typeSelect, measurementType);
      await waitFor(() => {
        expect(screen.getByRole('option', { name: /v1 · Vigente/i })).toBeInTheDocument();
        expect(
          screen.queryByRole('option', { name: /v2 · En validación/i }),
        ).not.toBeInTheDocument();
      });
    }
  });

  it('shows the semester selector only for P622', async () => {
    const user = userEvent.setup();
    setupCatalogAndSemesters();

    renderWithProviders(<ProcessExecutionForm onCreated={vi.fn()} onCancel={vi.fn()} />, {
      withRouter: false,
    });

    expect(screen.getByLabelText(/Año/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Semestre/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Proceso$/i), 'P622');

    expect(await screen.findByLabelText(/Semestre/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Año/i)).not.toBeInTheDocument();
  });

  it('warns when there is no version that fits the process type', async () => {
    const user = userEvent.setup();
    setupCatalogAndSemesters(
      SAMPLE_CATALOG_VERSIONS.filter((v) => v.status !== 'APPROVED'),
      SAMPLE_SEMESTERS,
    );

    renderWithProviders(<ProcessExecutionForm onCreated={vi.fn()} onCancel={vi.fn()} />, {
      withRouter: false,
    });

    await user.selectOptions(screen.getByLabelText(/^Proceso$/i), 'P612');

    expect(
      await screen.findByText(/No existe una versión de catálogo en estado «Vigente»/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear ejecución/i })).toBeDisabled();
  });

  it('sends one request when the form is submitted twice', async () => {
    const user = userEvent.setup();
    let postCalls = 0;
    setupCatalogAndSemesters();
    server.use(
      http.post('*/process-executions', async () => {
        postCalls += 1;
        await delay(40);
        return HttpResponse.json(SAMPLE_PROCESS_EXECUTION_DTO, { status: 201 });
      }),
    );

    const onCreated = vi.fn();
    renderWithProviders(<ProcessExecutionForm onCreated={onCreated} onCancel={vi.fn()} />, {
      withRouter: false,
    });

    const typeSelect = screen.getByLabelText(/^Proceso$/i);
    await user.selectOptions(typeSelect, 'P612');

    await user.selectOptions(screen.getByLabelText(/^Proceso$/i), 'P612');
    const versionSelect = await screen.findByLabelText(/Versión de catálogo/i);
    await waitFor(() => expect((versionSelect as HTMLSelectElement).value).toBe('cv-approved-1'));

    const submitButton = screen.getByRole('button', { name: /Crear ejecución/i });
    await user.dblClick(submitButton);

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(postCalls).toBe(1);
  });

  it('shows the server message when the name already exists', async () => {
    const user = userEvent.setup();
    setupCatalogAndSemesters();
    server.use(
      http.post('*/process-executions', () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message:
                'Ya existe una ejecución de proceso activa con el nombre «Medición anual de OE 2027».',
            },
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<ProcessExecutionForm onCreated={vi.fn()} onCancel={vi.fn()} />, {
      withRouter: false,
    });

    const typeSelect = screen.getByLabelText(/^Proceso$/i);
    await user.selectOptions(typeSelect, 'P612');

    await user.selectOptions(screen.getByLabelText(/^Proceso$/i), 'P612');
    const versionSelect = await screen.findByLabelText(/Versión de catálogo/i);
    await waitFor(() => expect((versionSelect as HTMLSelectElement).value).toBe('cv-approved-1'));

    await user.click(screen.getByRole('button', { name: /Crear ejecución/i }));

    expect(
      await screen.findByText(/Ya existe una ejecución de proceso activa con el nombre/i),
    ).toBeInTheDocument();
  });

  it('shows a permission alert when catalog versions return 403', async () => {
    server.use(
      http.get('*/catalog-versions', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
          { status: 403 },
        ),
      ),
      http.get('*/semesters', () => HttpResponse.json({ items: SAMPLE_SEMESTERS })),
    );

    renderWithProviders(<ProcessExecutionForm onCreated={vi.fn()} onCancel={vi.fn()} />, {
      withRouter: false,
    });

    expect(
      await screen.findByText(/No tienes el permiso necesario \(catalogo\.ver\)/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear ejecución/i })).toBeDisabled();
  });

  it('labels every field and is operable by keyboard', async () => {
    const user = userEvent.setup();
    setupCatalogAndSemesters();

    renderWithProviders(<ProcessExecutionForm onCreated={vi.fn()} onCancel={vi.fn()} />, {
      withRouter: false,
    });

    const typeSelect = screen.getByLabelText(/^Proceso$/i);
    const yearInput = screen.getByLabelText(/Año/i);
    const versionSelect = await screen.findByLabelText(/Versión de catálogo/i);
    const nameInput = screen.getByLabelText(/Nombre \(opcional\)/i);

    await user.tab();
    expect(typeSelect).toHaveFocus();
    await user.tab();
    expect(yearInput).toHaveFocus();
    await user.tab();
    expect(versionSelect).toHaveFocus();
    await user.tab();
    expect(nameInput).toHaveFocus();
  });

  it('starts without a selected process and reports the three select messages without calling the api', async () => {
    const user = userEvent.setup();
    let postCalls = 0;
    setupCatalogAndSemesters();
    server.use(
      http.post('*/process-executions', () => {
        postCalls += 1;
        return HttpResponse.json(SAMPLE_PROCESS_EXECUTION_DTO, { status: 201 });
      }),
    );

    renderWithProviders(<ProcessExecutionForm onCreated={vi.fn()} onCancel={vi.fn()} />, {
      withRouter: false,
    });

    const typeSelect = screen.getByLabelText(/^Proceso$/i) as HTMLSelectElement;
    expect(typeSelect.value).toBe('');

    await user.click(screen.getByRole('button', { name: /Crear ejecución/i }));

    const alerts = await screen.findAllByRole('alert');
    const alertTexts = alerts.map((a) => a.textContent);
    expect(alertTexts).toContain('Selecciona un proceso');
    expect(alertTexts).toContain('Selecciona una versión de catálogo');
    expect(postCalls).toBe(0);

    await user.selectOptions(typeSelect, 'P622');
    const semesterSelect = (await screen.findByLabelText(/Semestre/i)) as HTMLSelectElement;
    await user.selectOptions(semesterSelect, '');
    await user.click(screen.getByRole('button', { name: /Crear ejecución/i }));

    const nextAlerts = await screen.findAllByRole('alert');
    expect(nextAlerts.map((a) => a.textContent)).toContain('Selecciona un semestre');
    expect(postCalls).toBe(0);
  });

  it('links to the catalog when no version is in validation', async () => {
    const user = userEvent.setup();
    setupCatalogAndSemesters(
      SAMPLE_CATALOG_VERSIONS.filter((v) => v.status !== 'IN_VALIDATION'),
      SAMPLE_SEMESTERS,
    );

    renderWithProviders(<ProcessExecutionForm onCreated={vi.fn()} onCancel={vi.fn()} />, {
      withRouter: true,
    });

    await user.selectOptions(await screen.findByLabelText(/^Proceso$/i), 'P611');

    expect(
      await screen.findByText(/Envía una versión a validación para crear este proceso/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Versión de catálogo/i)).toBeDisabled();
    expect(screen.getByRole('link', { name: /Catálogo de versiones/i })).toHaveAttribute(
      'href',
      '/catalogo/versiones',
    );
  });
});
