import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  EMPLOYER_LIST_DTO,
  EMPLOYER_LIST_MEMBER,
  GRADUATE_LIST_DTO,
  GRADUATE_LIST_MEMBER,
} from '../test/stakeholder-lists-fixtures';
import {
  INSTITUTION_STAKEHOLDER,
  PERSON_STAKEHOLDER,
  makeListResponse,
} from '../test/stakeholders-fixtures';
import { StakeholderListMemberPicker } from './stakeholder-list-member-picker';

describe('StakeholderListMemberPicker (HU-022, T-022-28)', () => {
  it('adds a person from the registry', async () => {
    const user = userEvent.setup();
    const onMemberAdded = vi.fn();

    server.use(
      http.get('*/stakeholders', () => HttpResponse.json(makeListResponse([PERSON_STAKEHOLDER]))),
      http.post('*/stakeholder-lists/:id/members', () =>
        HttpResponse.json(GRADUATE_LIST_MEMBER, { status: 201 }),
      ),
    );

    renderWithProviders(
      <StakeholderListMemberPicker list={GRADUATE_LIST_DTO} onMemberAdded={onMemberAdded} />,
    );

    const addButton = await screen.findByRole('button', {
      name: /Agregar Ana Lucia Torres a la lista/i,
    });
    await user.click(addButton);

    await waitFor(() => expect(onMemberAdded).toHaveBeenCalledWith(GRADUATE_LIST_MEMBER));
  });

  it('asks for the representative when adding to the employers list', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;
    const onMemberAdded = vi.fn();

    server.use(
      http.get('*/stakeholders', () =>
        HttpResponse.json(makeListResponse([INSTITUTION_STAKEHOLDER])),
      ),
      http.post('*/stakeholder-lists/:id/members', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(EMPLOYER_LIST_MEMBER, { status: 201 });
      }),
    );

    renderWithProviders(
      <StakeholderListMemberPicker
        list={{ ...EMPLOYER_LIST_DTO, memberCount: 0, members: [] }}
        onMemberAdded={onMemberAdded}
      />,
    );

    const addButton = await screen.findByRole('button', {
      name: /Agregar Tech Amazonas SAC a la lista/i,
    });
    await user.click(addButton);

    const repInput = screen.getByLabelText(/Representante legal/i);
    await user.type(repInput, 'Carlos Mendoza');
    await user.click(screen.getByRole('button', { name: /Confirmar/i }));

    await waitFor(() => expect(onMemberAdded).toHaveBeenCalledTimes(1));
    expect(capturedBody).toEqual({
      stakeholderId: INSTITUTION_STAKEHOLDER.id,
      representative: 'Carlos Mendoza',
    });
  });

  it('shows what is missing in the registry for a graduate (CA2)', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('*/stakeholders', () => HttpResponse.json(makeListResponse([PERSON_STAKEHOLDER]))),
      http.post('*/stakeholder-lists/:id/members', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Faltan campos obligatorios en el registro del constituyente',
              details: [
                { path: 'año de egreso', message: 'El campo año de egreso es obligatorio.' },
                { path: 'correo', message: 'El campo correo es obligatorio.' },
              ],
            },
          },
          { status: 400 },
        ),
      ),
    );

    renderWithProviders(<StakeholderListMemberPicker list={GRADUATE_LIST_DTO} />);

    const addButton = await screen.findByRole('button', {
      name: /Agregar Ana Lucia Torres a la lista/i,
    });
    await user.click(addButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Año de egreso, Correo/i);
    expect(screen.getByRole('link', { name: /Completar el registro/i })).toHaveAttribute(
      'href',
      `/constituyentes?editar=${PERSON_STAKEHOLDER.id}`,
    );
  });

  it('marks the members already in the list', async () => {
    server.use(
      http.get('*/stakeholders', () =>
        HttpResponse.json(makeListResponse([INSTITUTION_STAKEHOLDER])),
      ),
    );

    renderWithProviders(<StakeholderListMemberPicker list={EMPLOYER_LIST_DTO} />);

    expect(await screen.findByText(/En la lista/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Agregar Tech Amazonas SAC a la lista/i }),
    ).not.toBeInTheDocument();
  });

  it('explains a voided stakeholder (409)', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('*/stakeholders', () => HttpResponse.json(makeListResponse([PERSON_STAKEHOLDER]))),
      http.post('*/stakeholder-lists/:id/members', () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'No se puede agregar un constituyente anulado a la lista.',
            },
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<StakeholderListMemberPicker list={GRADUATE_LIST_DTO} />);

    const addButton = await screen.findByRole('button', {
      name: /Agregar Ana Lucia Torres a la lista/i,
    });
    await user.click(addButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(/constituyente anulado/i);
  });

  it('explains that employers list only active institutions', async () => {
    server.use(
      http.get('*/stakeholders', () =>
        HttpResponse.json(makeListResponse([INSTITUTION_STAKEHOLDER])),
      ),
    );

    renderWithProviders(<StakeholderListMemberPicker list={EMPLOYER_LIST_DTO} />);

    expect(
      await screen.findByText(/Solo se muestran instituciones activas del registro maestro/i),
    ).toBeInTheDocument();
  });

  it('invites to register institutions when none', async () => {
    server.use(http.get('*/stakeholders', () => HttpResponse.json(makeListResponse([]))));

    renderWithProviders(<StakeholderListMemberPicker list={EMPLOYER_LIST_DTO} />);

    expect(
      await screen.findByText(/Registra la institución en Constituyentes/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ir a Constituyentes/i })).toHaveAttribute(
      'href',
      '/constituyentes',
    );
  });
});
