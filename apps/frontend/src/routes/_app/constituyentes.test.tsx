import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { StakeholdersPage } from '@/features/stakeholders';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { Route } from './constituyentes';

const SAMPLE_PERSON_STAKEHOLDER = {
  id: 'stk-person-1',
  kind: 'PERSON' as const,
  fullName: 'Ana Lucia Torres',
  dni: '45678912',
  ruc: null,
  email: 'ana@ejemplo.pe',
  mobile: '987654321',
  institution: 'Tech SAC',
  position: 'Egresada',
  sector: null,
  graduationYear: 2021,
  cycle: null,
  status: 'ACTIVE' as const,
  voidReason: null,
  voidedAt: null,
  voidedBy: null,
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
};

describe('StakeholdersRoute (/constituyentes) (HU-021, HU-081, T-021-02, T-081-12)', () => {
  it('defines beforeLoad guard requiring constituyente.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('validates the editar search parameter', () => {
    const validator = Route.options.validateSearch as unknown as {
      parse: (input: unknown) => { editar?: string };
    };
    expect(validator.parse({ editar: 'stk-1' })).toEqual({ editar: 'stk-1' });
    expect(validator.parse({})).toEqual({});
  });

  it('renders the page title and empty state when authenticated with permission', async () => {
    server.use(
      http.get('*/stakeholders', () =>
        HttpResponse.json({
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        }),
      ),
    );

    const Component = Route.options.component;
    expect(Component).toBeDefined();
    if (Component) {
      renderWithProviders(<Component />, {
        withRouter: true,
        permissions: [{ code: 'constituyente.ver', scope: 'GLOBAL' }],
      });
      expect(
        await screen.findByRole('heading', { level: 1, name: /constituyentes/i }),
      ).toBeInTheDocument();
      expect(await screen.findByText(/no hay constituyentes registrados/i)).toBeInTheDocument();
    }
  });

  it('opens the stakeholder named by the editar parameter', async () => {
    server.use(
      http.get('*/stakeholders', () =>
        HttpResponse.json({
          items: [SAMPLE_PERSON_STAKEHOLDER],
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        }),
      ),
    );

    renderWithProviders(<StakeholdersPage initialEditId={SAMPLE_PERSON_STAKEHOLDER.id} />, {
      withRouter: false,
      permissions: [
        { code: 'constituyente.ver', scope: 'GLOBAL' },
        { code: 'constituyente.editar', scope: 'GLOBAL' },
      ],
    });

    expect(
      await screen.findByRole('heading', { name: /Editar constituyente/i }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue(SAMPLE_PERSON_STAKEHOLDER.fullName)).toBeInTheDocument();
  });
});
