import { StrictMode } from 'react';
import { screen, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { TemplatePreviewPanel } from './template-preview-panel';

const URL_PREVIEW = 'http://localhost:3000/templates/tpl-1/preview';
const administrator = [
  { code: 'plantilla.ver', scope: 'GLOBAL' as const },
  { code: 'plantilla.editar', scope: 'GLOBAL' as const },
];
const viewerOnly = [{ code: 'plantilla.ver', scope: 'GLOBAL' as const }];

function renderPanel(
  content = '<p>{{program.name}}</p>',
  permissions: typeof administrator | typeof viewerOnly = administrator,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return renderWithProviders(
    <StrictMode>
      <TemplatePreviewPanel templateId="tpl-1" content={content} />
    </StrictMode>,
    { permissions, queryClient, withRouter: false },
  );
}

describe('TemplatePreviewPanel (T-019-11, CA1, CA2)', () => {
  let createObjectUrlSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectUrlSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    if (typeof URL.createObjectURL !== 'function') {
      Object.defineProperty(URL, 'createObjectURL', {
        writable: true,
        configurable: true,
        value: () => 'blob:http://localhost/mock',
      });
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      Object.defineProperty(URL, 'revokeObjectURL', {
        writable: true,
        configurable: true,
        value: () => {},
      });
    }
    createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:http://localhost/preview-1');
    revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  it('shows the generated pdf when the preview button is pressed', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(URL_PREVIEW, () =>
        HttpResponse.json({
          pdfBase64: btoa('%PDF-1.4\nSample'),
          warnings: [],
        }),
      ),
    );

    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Vista previa' }));

    const iframe = await screen.findByTitle('Vista previa en PDF de la plantilla');
    expect(iframe).toHaveAttribute('src', 'blob:http://localhost/preview-1');
    expect(
      screen.getByRole('link', { name: /Abrir la vista previa en una pestaña nueva/i }),
    ).toHaveAttribute('href', 'blob:http://localhost/preview-1');
  });

  it('lists the unrecognized variables as a warning', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(URL_PREVIEW, () =>
        HttpResponse.json({
          pdfBase64: btoa('%PDF-1.4\nSample'),
          warnings: [{ variable: 'unknown.key' }, { variable: 'other.key' }],
        }),
      ),
    );

    renderPanel('<p>{{unknown.key}} {{other.key}}</p>');
    await user.click(screen.getByRole('button', { name: 'Vista previa' }));

    const warning = await screen.findByRole('status');
    expect(warning).toHaveTextContent(
      'El contenido usa variables que la plantilla no reconoce: {{unknown.key}}, {{other.key}}. Aparecen sin reemplazar en el PDF.',
    );
    expect(warning.parentElement).toHaveFocus();
  });

  it('shows the server message when the content is rejected', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(URL_PREVIEW, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'El contenido contiene una etiqueta no permitida.',
            },
          },
          { status: 400 },
        ),
      ),
    );

    renderPanel('<script>alert(1)</script>');
    await user.click(screen.getByRole('button', { name: 'Vista previa' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El contenido contiene una etiqueta no permitida.');
  });

  it('hides the pdf and asks to regenerate when the content changes', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(URL_PREVIEW, () =>
        HttpResponse.json({
          pdfBase64: btoa('%PDF-1.4\nSample'),
          warnings: [],
        }),
      ),
    );

    const { rerender } = renderPanel('<p>v1</p>');
    await user.click(screen.getByRole('button', { name: 'Vista previa' }));
    await screen.findByTitle('Vista previa en PDF de la plantilla');

    rerender(
      <StrictMode>
        <TemplatePreviewPanel templateId="tpl-1" content="<p>v2</p>" />
      </StrictMode>,
    );

    expect(screen.queryByTitle('Vista previa en PDF de la plantilla')).not.toBeInTheDocument();
    expect(
      screen.getByText('El contenido cambió desde la última vista previa. Genérala de nuevo.'),
    ).toBeInTheDocument();
  });

  it('does not show the panel without the edit permission', () => {
    renderPanel('<p>solo lectura</p>', viewerOnly);

    expect(screen.queryByRole('button', { name: 'Vista previa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Vista previa en PDF' })).not.toBeInTheDocument();
  });

  it('disables the preview button while the pdf is being generated', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    server.use(
      http.post(URL_PREVIEW, async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        await delay(5);
        return HttpResponse.json({
          pdfBase64: btoa('%PDF-1.4\nSample'),
          warnings: [],
        });
      }),
    );

    renderPanel();
    const button = screen.getByRole('button', { name: 'Vista previa' });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Generando vista previa…' })).toBeDisabled();
    });

    release();
    await screen.findByTitle('Vista previa en PDF de la plantilla');
    expect(screen.getByRole('button', { name: 'Vista previa' })).toBeEnabled();
  });

  it('revokes the object url when the panel unmounts', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(URL_PREVIEW, () =>
        HttpResponse.json({
          pdfBase64: btoa('%PDF-1.4\nSample'),
          warnings: [],
        }),
      ),
    );

    const { unmount } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Vista previa' }));
    await screen.findByTitle('Vista previa en PDF de la plantilla');

    unmount();

    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:http://localhost/preview-1');
  });
});
