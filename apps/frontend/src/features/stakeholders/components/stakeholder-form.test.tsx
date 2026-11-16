import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  INSTITUTION_STAKEHOLDER,
  PERSON_STAKEHOLDER,
  VOIDED_STAKEHOLDER,
  makeListResponse,
} from '../test/stakeholders-fixtures';
import { StakeholderForm } from './stakeholder-form';

describe('StakeholderForm (HU-021, T-021-18, T-021-29)', () => {
  it('registers a person with only required fields and calls onSaved (CA1)', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    let sentBody: unknown = null;

    server.use(
      http.post('*/stakeholders', async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json(PERSON_STAKEHOLDER, { status: 201 });
      }),
    );

    renderWithProviders(<StakeholderForm mode="register" onCancel={vi.fn()} onSaved={onSaved} />, {
      withRouter: false,
    });

    await user.type(screen.getByLabelText(/nombres y apellidos/i), 'Ana Lucia Torres');
    await user.type(screen.getByLabelText(/^dni$/i), '45678912');
    await user.click(screen.getByRole('button', { name: /guardar constituyente/i }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(PERSON_STAKEHOLDER, 'register');
    });
    expect(sentBody).toMatchObject({
      kind: 'PERSON',
      fullName: 'Ana Lucia Torres',
      dni: '45678912',
      email: null,
    });
  });

  it('registers an institution', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    let sentBody: unknown = null;

    server.use(
      http.post('*/stakeholders', async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json(INSTITUTION_STAKEHOLDER, { status: 201 });
      }),
    );

    renderWithProviders(<StakeholderForm mode="register" onCancel={vi.fn()} onSaved={onSaved} />, {
      withRouter: false,
    });

    await user.selectOptions(screen.getByLabelText(/tipo/i), 'INSTITUTION');
    await user.type(screen.getByLabelText(/razón social/i), 'Tech Amazonas SAC');
    await user.type(screen.getByLabelText(/^ruc$/i), '20123456789');
    await user.click(screen.getByRole('button', { name: /guardar constituyente/i }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(INSTITUTION_STAKEHOLDER, 'register');
    });
    expect(sentBody).toMatchObject({
      kind: 'INSTITUTION',
      fullName: 'Tech Amazonas SAC',
      ruc: '20123456789',
    });
  });

  it('shows the existing record when the document is already registered and offers to edit active record (CA2)', async () => {
    const user = userEvent.setup();
    const onSelectExisting = vi.fn();

    server.use(
      http.get('*/me/permissions', () =>
        HttpResponse.json({
          permissions: [
            { code: 'constituyente.ver', scope: 'GLOBAL' },
            { code: 'constituyente.editar', scope: 'GLOBAL' },
          ],
        }),
      ),
      http.post('*/stakeholders', () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Ya existe un constituyente con ese DNI.' } },
          { status: 409 },
        ),
      ),
      http.get('*/stakeholders', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('document') === '45678912') {
          return HttpResponse.json(makeListResponse([PERSON_STAKEHOLDER]));
        }
        return HttpResponse.json(makeListResponse([]));
      }),
    );

    renderWithProviders(
      <StakeholderForm
        mode="register"
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onSelectExisting={onSelectExisting}
      />,
      {
        withRouter: false,
        permissions: [
          { code: 'constituyente.ver', scope: 'GLOBAL' },
          { code: 'constituyente.editar', scope: 'GLOBAL' },
        ],
      },
    );

    await user.type(screen.getByLabelText(/nombres y apellidos/i), 'Ana Duplicada');
    await user.type(screen.getByLabelText(/^dni$/i), '45678912');
    await user.click(screen.getByRole('button', { name: /guardar constituyente/i }));

    expect(
      await screen.findByText(/ya existe un constituyente con este documento/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Ana Lucia Torres')).toBeInTheDocument();

    const editBtn = screen.getByRole('button', { name: /editar este constituyente/i });
    await user.click(editBtn);
    expect(onSelectExisting).toHaveBeenCalledWith(PERSON_STAKEHOLDER);
  });

  it('shows a voided existing record without offering to edit it', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('*/me/permissions', () =>
        HttpResponse.json({
          permissions: [
            { code: 'constituyente.ver', scope: 'GLOBAL' },
            { code: 'constituyente.editar', scope: 'GLOBAL' },
          ],
        }),
      ),
      http.post('*/stakeholders', () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Ya existe un constituyente con ese DNI.' } },
          { status: 409 },
        ),
      ),
      http.get('*/stakeholders', () => HttpResponse.json(makeListResponse([VOIDED_STAKEHOLDER]))),
    );

    renderWithProviders(
      <StakeholderForm
        mode="register"
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onSelectExisting={vi.fn()}
      />,
      {
        withRouter: false,
        permissions: [
          { code: 'constituyente.ver', scope: 'GLOBAL' },
          { code: 'constituyente.editar', scope: 'GLOBAL' },
        ],
      },
    );

    await user.type(screen.getByLabelText(/nombres y apellidos/i), 'Mario Duplicado');
    await user.type(screen.getByLabelText(/^dni$/i), '33445566');
    await user.click(screen.getByRole('button', { name: /guardar constituyente/i }));

    expect(await screen.findByText('Mario Vega')).toBeInTheDocument();
    expect(screen.getByText('Anulado')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /editar este constituyente/i }),
    ).not.toBeInTheDocument();
  });

  it('disables the save button when nothing changed and sends only changed fields with null on clear', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    let patchBody: unknown = null;

    server.use(
      http.patch('*/stakeholders/:id', async ({ request }) => {
        patchBody = await request.json();
        return HttpResponse.json({ ...PERSON_STAKEHOLDER, email: null, position: 'Directora' });
      }),
    );

    renderWithProviders(
      <StakeholderForm
        mode="edit"
        initialStakeholder={PERSON_STAKEHOLDER}
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
      { withRouter: false },
    );

    expect(screen.getByRole('button', { name: /sin cambios/i })).toBeDisabled();
    expect(screen.getByLabelText(/tipo/i)).toBeDisabled();

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    await user.clear(emailInput);
    const positionInput = screen.getByLabelText(/cargo/i);
    await user.clear(positionInput);
    await user.type(positionInput, 'Directora');

    const saveBtn = screen.getByRole('button', { name: /guardar cambios/i });
    expect(saveBtn).toBeEnabled();
    await user.click(saveBtn);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(patchBody).toEqual({
      email: null,
      position: 'Directora',
    });
  });

  it('shows validation messages with accessible alerts and moves focus to error alert', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('*/me/permissions', () =>
        HttpResponse.json({
          permissions: [
            { code: 'constituyente.ver', scope: 'GLOBAL' },
            { code: 'constituyente.editar', scope: 'GLOBAL' },
          ],
        }),
      ),
      http.post('*/stakeholders', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Error de servidor' } },
          { status: 500 },
        ),
      ),
    );

    renderWithProviders(<StakeholderForm mode="register" onCancel={vi.fn()} onSaved={vi.fn()} />, {
      withRouter: false,
    });

    await user.type(screen.getByLabelText(/nombres y apellidos/i), 'Ana');
    await user.type(screen.getByLabelText(/^dni$/i), '123');
    await user.click(screen.getByRole('button', { name: /guardar constituyente/i }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((el) => /8 dígitos/i.test(el.textContent ?? ''))).toBe(true);

    await user.type(screen.getByLabelText(/^dni$/i), '45678');
    await user.click(screen.getByRole('button', { name: /guardar constituyente/i }));

    const errorBanner = await screen.findByText(/problema del servidor/i);
    const alertContainer = errorBanner.closest('[role="alert"]');
    expect(alertContainer).toHaveFocus();
  });
});
