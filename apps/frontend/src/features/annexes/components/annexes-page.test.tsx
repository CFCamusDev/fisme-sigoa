import { ANNEX_CATALOG } from '@sigoa/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { AnnexesPage } from './annexes-page';

describe('AnnexesPage (T-070-11, CA1)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists the eleven annexes and names each button after its annex', async () => {
    renderWithProviders(<AnnexesPage />);

    expect(await screen.findByRole('heading', { name: 'Anexos oficiales' })).toBeInTheDocument();

    for (const entry of ANNEX_CATALOG) {
      expect(screen.getByText(entry.code)).toBeInTheDocument();
      expect(screen.getByText(entry.name)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: `Descargar PDF del ${entry.name}` }),
      ).toBeInTheDocument();
    }
  });

  it('downloads the annex pdf when the button is pressed and shows a success message with the template version', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    server.use(
      http.get('http://localhost:3000/annexes/FO-01/pdf', () => {
        return new HttpResponse(new TextEncoder().encode('%PDF-1.4\nAnnex'), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="fo-01-v2.pdf"',
            'X-Template-Version': '2',
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<AnnexesPage />);

    await user.click(
      await screen.findByRole('button', { name: 'Descargar PDF del Anexo 1. Cronograma' }),
    );

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Se descargó Anexo 1. Cronograma (versión 2).');
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    revokeObjectUrlSpy.mockRestore();
  });

  it('disables the download button of an annex while its pdf is being generated', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    server.use(
      http.get('http://localhost:3000/annexes/FO-02/pdf', async () => {
        await delay(10);
        await gate;
        return new HttpResponse(new TextEncoder().encode('%PDF-1.4\nActa'), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="fo-02-v1.pdf"',
            'X-Template-Version': '1',
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<AnnexesPage />);

    const button = await screen.findByRole('button', { name: 'Descargar PDF del Anexo 2. Acta' });
    await user.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Generando…');
    });

    release();

    await waitFor(() => {
      expect(button).toBeEnabled();
      expect(button).toHaveTextContent('Descargar PDF');
    });
  });

  it('shows the server message when the download fails', async () => {
    server.use(
      http.get('http://localhost:3000/annexes/FO-04/pdf', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Ya estás generando un anexo. Espera a que termine.',
            },
          },
          { status: 409 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<AnnexesPage />);

    await user.click(
      await screen.findByRole('button', {
        name: 'Descargar PDF del Anexo 4. Acciones de mejora',
      }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ya estás generando un anexo. Espera a que termine.');
  });

  it('renders the title with the shared page header', async () => {
    renderWithProviders(<AnnexesPage />);

    const heading = await screen.findByRole('heading', { level: 1, name: 'Anexos oficiales' });
    expect(heading).toHaveClass('text-h2', 'sm:text-h1');
  });
});
