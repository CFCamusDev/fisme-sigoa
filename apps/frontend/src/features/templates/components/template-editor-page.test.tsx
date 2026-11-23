import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { buildTemplateDetail, buildTemplateVersion } from '@/test/template-fixtures';
import { TemplateEditorPage } from './template-editor-page';

const BASE = 'http://localhost:3000/templates/tpl-1';

const administrator = [
  { code: 'plantilla.ver', scope: 'GLOBAL' as const },
  { code: 'plantilla.editar', scope: 'GLOBAL' as const },
  { code: 'plantilla.publicar', scope: 'GLOBAL' as const },
];

const readOnlyUser = [{ code: 'plantilla.ver', scope: 'GLOBAL' as const }];

describe('TemplateEditorPage (HU-082, T-082-24)', () => {
  it('renders header, tabs and preserves unsaved content across tab switches', async () => {
    const user = userEvent.setup();
    server.use(http.get(BASE, () => HttpResponse.json(buildTemplateDetail({ withDraft: true }))));

    renderWithProviders(<TemplateEditorPage templateId="tpl-1" />, {
      permissions: administrator,
      initialEntries: ['/plantillas/tpl-1'],
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: /FO-01 · Anexo 1\. Cronograma/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a plantillas' })).toHaveAttribute(
      'href',
      '/plantillas',
    );

    expect(screen.getByRole('tab', { name: 'Contenido' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Variables' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Vista previa' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Historial' })).toBeInTheDocument();

    const textarea = screen.getByRole('textbox', { name: 'Contenido HTML' });
    await user.type(textarea, ' borrador');

    await user.click(screen.getByRole('tab', { name: 'Historial' }));
    expect(screen.getByRole('heading', { name: 'Historial de versiones' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Variables' }));
    await user.click(screen.getByRole('button', { name: 'Insertar {{program.name}}' }));

    expect(screen.getByRole('tab', { name: 'Contenido' })).toHaveAttribute('aria-selected', 'true');
    expect(
      (screen.getByRole('textbox', { name: 'Contenido HTML' }) as HTMLTextAreaElement).value,
    ).toContain('borrador{{program.name}}');
  });

  it('hides the preview tab when user only has view permission', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(buildTemplateDetail({ withDraft: true }))));

    renderWithProviders(<TemplateEditorPage templateId="tpl-1" />, {
      permissions: readOnlyUser,
      initialEntries: ['/plantillas/tpl-1'],
    });

    await screen.findByRole('heading', { level: 1, name: /FO-01 · Anexo 1\. Cronograma/ });
    expect(screen.queryByRole('tab', { name: 'Vista previa' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Contenido HTML' })).toHaveAttribute('readonly');
  });

  it('shows not found state on 404', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(
          { statusCode: 404, error: 'Not Found', message: 'Plantilla no encontrada' },
          { status: 404 },
        ),
      ),
    );

    renderWithProviders(<TemplateEditorPage templateId="tpl-1" />, {
      permissions: administrator,
      initialEntries: ['/plantillas/tpl-1'],
    });

    expect(await screen.findByText('Plantilla no encontrada')).toBeInTheDocument();
  });

  it('prompts confirmation before leaving with unsaved changes', async () => {
    const user = userEvent.setup();
    server.use(http.get(BASE, () => HttpResponse.json(buildTemplateDetail({ withDraft: true }))));

    renderWithProviders(<TemplateEditorPage templateId="tpl-1" />, {
      permissions: administrator,
      initialEntries: ['/plantillas/tpl-1'],
    });

    const textarea = await screen.findByRole('textbox', { name: 'Contenido HTML' });
    await user.type(textarea, ' cambio');

    await user.click(screen.getByRole('link', { name: 'Volver a plantillas' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Cambios sin guardar')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('triggers preview tab and request from the sticky action bar', async () => {
    const user = userEvent.setup();
    let previewCalls = 0;
    server.use(
      http.get(BASE, () => HttpResponse.json(buildTemplateDetail({ withDraft: true }))),
      http.post(`${BASE}/preview`, () => {
        previewCalls += 1;
        return HttpResponse.json({ pdfBase64: btoa('%PDF-1.4\nDraft'), warnings: [] });
      }),
    );

    renderWithProviders(<TemplateEditorPage templateId="tpl-1" />, {
      permissions: administrator,
      initialEntries: ['/plantillas/tpl-1'],
    });

    await screen.findByRole('textbox', { name: 'Contenido HTML' });
    const actionBar = screen.getByTestId('sticky-action-bar');
    await user.click(within(actionBar).getByRole('button', { name: 'Vista previa' }));

    expect(screen.getByRole('tab', { name: 'Vista previa' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() => expect(previewCalls).toBe(1));
  });

  it('restores focus to publish button when closing the publish confirm dialog', async () => {
    const user = userEvent.setup();
    server.use(http.get(BASE, () => HttpResponse.json(buildTemplateDetail({ withDraft: true }))));

    renderWithProviders(<TemplateEditorPage templateId="tpl-1" />, {
      permissions: administrator,
      initialEntries: ['/plantillas/tpl-1'],
    });

    const publishButton = await screen.findByRole('button', { name: 'Publicar versión 2' });
    await user.click(publishButton);
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar la publicación' });

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(publishButton).toHaveFocus());
  });

  it('publishes once when the confirm button is activated twice', async () => {
    const user = userEvent.setup();
    let posts = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    server.use(
      http.get(BASE, () => HttpResponse.json(buildTemplateDetail({ withDraft: true }))),
      http.post(`${BASE}/publish`, async () => {
        posts += 1;
        await gate;
        return HttpResponse.json(
          buildTemplateVersion({ status: 'PUBLISHED', publishedAt: '2026-11-14T09:00:00.000Z' }),
        );
      }),
    );

    renderWithProviders(<TemplateEditorPage templateId="tpl-1" />, {
      permissions: administrator,
      initialEntries: ['/plantillas/tpl-1'],
    });

    await user.click(await screen.findByRole('button', { name: 'Publicar versión 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar la publicación' });
    const confirmButton = within(dialog).getByRole('button', { name: 'Confirmar' });

    await user.dblClick(confirmButton);
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Publicando…' })).toBeDisabled(),
    );
    expect(posts).toBe(1);

    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Versión v2 publicada.')).toBeInTheDocument();
  });
});
