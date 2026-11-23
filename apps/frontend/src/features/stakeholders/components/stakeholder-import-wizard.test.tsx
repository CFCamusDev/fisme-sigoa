import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STAKEHOLDER_IMPORT_MAX_FILE_BYTES } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { EMPLOYER_LIST_DTO } from '../test/stakeholder-lists-fixtures';
import { StakeholderImportResult } from './stakeholder-import-result';
import { StakeholderImportWizard } from './stakeholder-import-wizard';

function makeXlsxFile(name = 'empleadores.xlsx', sizeBytes = 32): File {
  const bytes = new Uint8Array(sizeBytes);
  bytes[0] = 0x50;
  bytes[1] = 0x4b;
  bytes[2] = 0x03;
  bytes[3] = 0x04;
  return new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: 1700000000000,
  });
}

const MIXED_PREVIEW = {
  listId: EMPLOYER_LIST_DTO.id,
  listType: 'EMPLOYER' as const,
  totals: { total: 3, new: 1, existing: 1, alreadyInList: 0, invalid: 1 },
  rows: [
    {
      rowNumber: 2,
      status: 'NEW' as const,
      document: '20111111111',
      fullName: 'Nueva Empresa SAC',
      errors: [],
    },
    {
      rowNumber: 3,
      status: 'EXISTING' as const,
      document: '20123456789',
      fullName: 'Tech Amazonas SAC',
      errors: [],
    },
    {
      rowNumber: 4,
      status: 'INVALID' as const,
      document: '123',
      fullName: 'Fila Con Error',
      errors: ['El RUC debe tener exactamente 11 dígitos numéricos.'],
    },
  ],
};

describe('StakeholderImportWizard (HU-023, T-023-18)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the template of the list type', async () => {
    const user = userEvent.setup();
    let requestedType: string | null = null;
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    server.use(
      http.get('*/stakeholder-lists/excel-template', ({ request }) => {
        requestedType = new URL(request.url).searchParams.get('type');
        return new HttpResponse(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="plantilla-employer.xlsx"',
          },
        });
      }),
    );

    renderWithProviders(
      <StakeholderImportWizard list={EMPLOYER_LIST_DTO} onImported={vi.fn()} onCancel={vi.fn()} />,
      { withRouter: false },
    );

    await user.click(screen.getByRole('button', { name: /Descargar plantilla/i }));

    await waitFor(() => expect(requestedType).toBe('EMPLOYER'));
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('rejects a file that is not an xlsx or exceeds 2 MiB before sending', async () => {
    let previewCalled = false;
    server.use(
      http.post('*/stakeholder-lists/:id/import/preview', () => {
        previewCalled = true;
        return HttpResponse.json(MIXED_PREVIEW);
      }),
    );

    renderWithProviders(
      <StakeholderImportWizard list={EMPLOYER_LIST_DTO} onImported={vi.fn()} onCancel={vi.fn()} />,
      { withRouter: false },
    );

    const fileInput = screen.getByLabelText(/Archivo Excel \(\.xlsx\)/i) as HTMLInputElement;

    const csvFile = new File(['a,b,c'], 'datos.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/extensión \.xlsx/i);

    const oversizedFile = makeXlsxFile('grande.xlsx', STAKEHOLDER_IMPORT_MAX_FILE_BYTES + 1);
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/2 MiB/i);
    expect(screen.getByRole('button', { name: /Ver vista previa/i })).toBeDisabled();
    expect(previewCalled).toBe(false);
  });

  it('shows the preview with valid rows and row errors, filters errors, announces summary and moves focus', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/stakeholder-lists/:id/import/preview', () => HttpResponse.json(MIXED_PREVIEW)),
    );

    renderWithProviders(
      <StakeholderImportWizard list={EMPLOYER_LIST_DTO} onImported={vi.fn()} onCancel={vi.fn()} />,
      { withRouter: false },
    );

    const fileInput = screen.getByLabelText(/Archivo Excel \(\.xlsx\)/i) as HTMLInputElement;
    await user.upload(fileInput, makeXlsxFile());
    await user.click(screen.getByRole('button', { name: /Ver vista previa/i }));

    const heading = await screen.findByRole('heading', {
      name: /3 filas: 1 nuevas, 1 ya registradas, 0 ya en la lista, 1 con errores/i,
    });
    expect(heading).toHaveFocus();
    expect(heading.closest('[aria-live="polite"]')).not.toBeNull();
    expect(screen.getByText('Nueva Empresa SAC')).toBeInTheDocument();
    expect(screen.getByText('Tech Amazonas SAC')).toBeInTheDocument();
    expect(screen.getByText('Fila Con Error')).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Mostrar solo filas con errores/i));
    expect(screen.queryByText('Nueva Empresa SAC')).not.toBeInTheDocument();
    expect(screen.queryByText('Tech Amazonas SAC')).not.toBeInTheDocument();
    expect(screen.getByText('Fila Con Error')).toBeInTheDocument();
  });

  it('cancelling the preview sends no confirm request', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    let confirmCalled = false;

    server.use(
      http.post('*/stakeholder-lists/:id/import/preview', () => HttpResponse.json(MIXED_PREVIEW)),
      http.post('*/stakeholder-lists/:id/import/confirm', () => {
        confirmCalled = true;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    renderWithProviders(
      <StakeholderImportWizard list={EMPLOYER_LIST_DTO} onImported={vi.fn()} onCancel={onCancel} />,
      { withRouter: false },
    );

    await user.upload(screen.getByLabelText(/Archivo Excel \(\.xlsx\)/i), makeXlsxFile());
    await user.click(screen.getByRole('button', { name: /Ver vista previa/i }));
    await screen.findByText('Nueva Empresa SAC');

    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(confirmCalled).toBe(false);
  });

  it('confirms once even with a double click and delivers totals and rejected rows', async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();
    let confirmCalls = 0;

    server.use(
      http.post('*/stakeholder-lists/:id/import/preview', () => HttpResponse.json(MIXED_PREVIEW)),
      http.post('*/stakeholder-lists/:id/import/confirm', async () => {
        confirmCalls += 1;
        await delay(40);
        return HttpResponse.json(
          {
            importId: 'imp-1',
            listId: EMPLOYER_LIST_DTO.id,
            totals: { created: 1, reused: 1, added: 2, alreadyInList: 0, rejected: 1 },
            rejectedRows: [
              { rowNumber: 4, errors: ['El RUC debe tener exactamente 11 dígitos numéricos.'] },
            ],
          },
          { status: 201 },
        );
      }),
    );

    renderWithProviders(
      <StakeholderImportWizard
        list={EMPLOYER_LIST_DTO}
        onImported={onImported}
        onCancel={vi.fn()}
      />,
      { withRouter: false },
    );

    await user.upload(screen.getByLabelText(/Archivo Excel \(\.xlsx\)/i), makeXlsxFile());
    await user.click(screen.getByRole('button', { name: /Ver vista previa/i }));
    const confirmButton = await screen.findByRole('button', { name: /Confirmar importación/i });

    await user.dblClick(confirmButton);

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(confirmCalls).toBe(1);
    expect(onImported.mock.calls[0]?.[0]?.totals).toEqual({
      created: 1,
      reused: 1,
      added: 2,
      alreadyInList: 0,
      rejected: 1,
    });
  });

  it('disables confirm when there are no valid rows', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/stakeholder-lists/:id/import/preview', () =>
        HttpResponse.json({
          listId: EMPLOYER_LIST_DTO.id,
          listType: 'EMPLOYER',
          totals: { total: 1, new: 0, existing: 0, alreadyInList: 0, invalid: 1 },
          rows: [
            {
              rowNumber: 2,
              status: 'INVALID',
              document: '123',
              fullName: 'Invalido',
              errors: ['RUC inválido'],
            },
          ],
        }),
      ),
    );

    renderWithProviders(
      <StakeholderImportWizard list={EMPLOYER_LIST_DTO} onImported={vi.fn()} onCancel={vi.fn()} />,
      { withRouter: false },
    );

    await user.upload(screen.getByLabelText(/Archivo Excel \(\.xlsx\)/i), makeXlsxFile());
    await user.click(screen.getByRole('button', { name: /Ver vista previa/i }));

    const confirmButton = await screen.findByRole('button', { name: /Confirmar importación/i });
    expect(confirmButton).toBeDisabled();
  });

  it('shows a specific message for each error status including blob download failure', async () => {
    const user = userEvent.setup();
    let templateStatus = 403;
    let previewStatus = 404;

    server.use(
      http.get('*/stakeholder-lists/excel-template', () => {
        if (templateStatus === 403) {
          return HttpResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Forbidden' } },
            { status: 403 },
          );
        }
        return HttpResponse.json({ error: { code: 'INTERNAL', message: 'Boom' } }, { status: 500 });
      }),
      http.post('*/stakeholder-lists/:id/import/preview', () => {
        if (previewStatus === 404) {
          return HttpResponse.json(
            { error: { code: 'NOT_FOUND', message: 'Not found' } },
            { status: 404 },
          );
        }
        return HttpResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Encabezados incorrectos' } },
          { status: 400 },
        );
      }),
    );

    renderWithProviders(
      <StakeholderImportWizard list={EMPLOYER_LIST_DTO} onImported={vi.fn()} onCancel={vi.fn()} />,
      { withRouter: false },
    );

    await user.click(screen.getByRole('button', { name: /Descargar plantilla/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /No tienes permiso para importar constituyentes/i,
    );

    templateStatus = 500;
    await user.click(screen.getByRole('button', { name: /Descargar plantilla/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/problema del servidor/i);

    await user.upload(screen.getByLabelText(/Archivo Excel \(\.xlsx\)/i), makeXlsxFile());
    await user.click(screen.getByRole('button', { name: /Ver vista previa/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/ya no existe/i);

    previewStatus = 400;
    await user.click(screen.getByRole('button', { name: /Ver vista previa/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Encabezados incorrectos/i);
  });

  it('shows the totals and the rejected rows after confirming', () => {
    renderWithProviders(
      <StakeholderImportResult
        result={{
          importId: 'imp-1',
          listId: EMPLOYER_LIST_DTO.id,
          totals: { created: 2, reused: 1, added: 3, alreadyInList: 1, rejected: 1 },
          rejectedRows: [
            { rowNumber: 5, errors: ['El RUC debe tener exactamente 11 dígitos numéricos.'] },
          ],
        }}
      />,
      { withRouter: false },
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(
      /2 creados, 1 reutilizados, 3 agregados, 1 ya en la lista, 1 rechazados/i,
    );
    expect(status).toHaveTextContent(/Fila 5: El RUC debe tener exactamente 11 dígitos numéricos/i);
  });

  it('lists every error per row in the preview table while keeping the error filter', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/stakeholder-lists/:id/import/preview', () =>
        HttpResponse.json({
          ...MIXED_PREVIEW,
          rows: [
            ...MIXED_PREVIEW.rows.slice(0, 2),
            {
              rowNumber: 4,
              status: 'INVALID',
              document: '123',
              fullName: 'Fila Con Varios Errores',
              errors: [
                'El RUC debe tener exactamente 11 dígitos numéricos.',
                'El correo electrónico no tiene un formato válido.',
              ],
            },
          ],
        }),
      ),
    );

    renderWithProviders(
      <StakeholderImportWizard list={EMPLOYER_LIST_DTO} onImported={vi.fn()} onCancel={vi.fn()} />,
      { withRouter: false },
    );

    await user.upload(screen.getByLabelText(/Archivo Excel \(\.xlsx\)/i), makeXlsxFile());
    await user.click(screen.getByRole('button', { name: /Ver vista previa/i }));

    expect(
      await screen.findByText('El RUC debe tener exactamente 11 dígitos numéricos.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('El correo electrónico no tiene un formato válido.'),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Mostrar solo filas con errores/i));
    expect(screen.queryByText('Nueva Empresa SAC')).not.toBeInTheDocument();
    expect(screen.getByText('Fila Con Varios Errores')).toBeInTheDocument();
  });
});
