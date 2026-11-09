import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoleDto, UserAccessRole } from '@sigoa/shared';
import { renderWithProviders } from '@/test/render';
import { UserRolesEditor } from './user-roles-editor';

const mockCatalogRoles: RoleDto[] = [
  {
    id: 'role-teacher',
    code: 'TEACHER',
    name: 'Docente',
    description: 'Acceso a cursos asignados',
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 10,
    permissions: [],
    updatedAt: '2026-11-06T15:00:00.000Z',
  },
  {
    id: 'role-director',
    code: 'PROGRAM_DIRECTOR',
    name: 'Director de Programa',
    description: 'Gestión académica completa',
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 1,
    permissions: [],
    updatedAt: '2026-11-06T15:00:00.000Z',
  },
];

describe('UserRolesEditor Component (HU-007, T-007-16, D19, D20)', () => {
  it('lists active roles and marks currently assigned roles', () => {
    const assignedRoles: UserAccessRole[] = [
      { id: 'role-teacher', code: 'TEACHER', name: 'Docente', status: 'ACTIVE' },
    ];

    renderWithProviders(
      <UserRolesEditor
        assignedRoles={assignedRoles}
        catalogRoles={mockCatalogRoles}
        onSave={vi.fn()}
      />,
      { withRouter: false },
    );

    const teacherCheckbox = screen.getByLabelText(/Docente/);
    const directorCheckbox = screen.getByLabelText(/Director de Programa/);

    expect(teacherCheckbox).toBeChecked();
    expect(directorCheckbox).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Guardar roles' })).toBeDisabled();
  });

  it('keeps an assigned inactive role removable but not addable (D19)', async () => {
    const user = userEvent.setup();
    const assignedRoles: UserAccessRole[] = [
      { id: 'role-teacher', code: 'TEACHER', name: 'Docente', status: 'ACTIVE' },
      { id: 'role-legacy', code: 'LEGACY_ROLE', name: 'Rol Antiguo', status: 'INACTIVE' },
    ];

    renderWithProviders(
      <UserRolesEditor
        assignedRoles={assignedRoles}
        catalogRoles={mockCatalogRoles}
        onSave={vi.fn()}
      />,
      { withRouter: false },
    );

    // Debe mostrarse el rol inactivo con su badge
    expect(screen.getByText('Rol Antiguo')).toBeInTheDocument();
    expect(screen.getByText(/No concede permisos; puedes quitarlo/)).toBeInTheDocument();

    const legacyCheckbox = screen.getByLabelText(/Rol Antiguo/);
    expect(legacyCheckbox).toBeChecked();
    expect(legacyCheckbox).toBeEnabled();

    // Si se desmarca, se deshabilita para volver a agregarlo
    await user.click(legacyCheckbox);
    expect(legacyCheckbox).not.toBeChecked();
    expect(legacyCheckbox).toBeDisabled();
  });

  it('blocks saving when no role is selected and displays a warning (D20)', async () => {
    const user = userEvent.setup();
    const assignedRoles: UserAccessRole[] = [
      { id: 'role-teacher', code: 'TEACHER', name: 'Docente', status: 'ACTIVE' },
    ];

    renderWithProviders(
      <UserRolesEditor
        assignedRoles={assignedRoles}
        catalogRoles={mockCatalogRoles}
        onSave={vi.fn()}
      />,
      { withRouter: false },
    );

    const teacherCheckbox = screen.getByLabelText(/Docente/);
    await user.click(teacherCheckbox);

    expect(teacherCheckbox).not.toBeChecked();
    expect(screen.getByText('Selecciona al menos un rol.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar roles' })).toBeDisabled();
  });

  it('shows changes count and saves sorted role ids', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();
    const assignedRoles: UserAccessRole[] = [
      { id: 'role-teacher', code: 'TEACHER', name: 'Docente', status: 'ACTIVE' },
    ];

    renderWithProviders(
      <UserRolesEditor
        assignedRoles={assignedRoles}
        catalogRoles={mockCatalogRoles}
        onSave={handleSave}
      />,
      { withRouter: false },
    );

    const directorCheckbox = screen.getByLabelText(/Director de Programa/);
    await user.click(directorCheckbox);

    expect(screen.getByText('1 cambio sin guardar')).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: 'Guardar roles' });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);
    expect(handleSave).toHaveBeenCalledWith(['role-director', 'role-teacher']);
  });

  it('discards unsaved changes when discard button is clicked', async () => {
    const user = userEvent.setup();
    const handleDiscard = vi.fn();
    const assignedRoles: UserAccessRole[] = [
      { id: 'role-teacher', code: 'TEACHER', name: 'Docente', status: 'ACTIVE' },
    ];

    renderWithProviders(
      <UserRolesEditor
        assignedRoles={assignedRoles}
        catalogRoles={mockCatalogRoles}
        onSave={vi.fn()}
        onDiscard={handleDiscard}
      />,
      { withRouter: false },
    );

    const directorCheckbox = screen.getByLabelText(/Director de Programa/);
    await user.click(directorCheckbox);
    expect(directorCheckbox).toBeChecked();

    const discardButton = screen.getByRole('button', { name: 'Descartar' });
    await user.click(discardButton);

    expect(directorCheckbox).not.toBeChecked();
    expect(handleDiscard).toHaveBeenCalled();
    expect(screen.getByText('0 cambios sin guardar')).toBeInTheDocument();
  });

  it('disables controls and displays loading text while isSaving is true', () => {
    const assignedRoles: UserAccessRole[] = [
      { id: 'role-teacher', code: 'TEACHER', name: 'Docente', status: 'ACTIVE' },
    ];

    renderWithProviders(
      <UserRolesEditor
        assignedRoles={assignedRoles}
        catalogRoles={mockCatalogRoles}
        onSave={vi.fn()}
        isSaving={true}
      />,
      { withRouter: false },
    );

    expect(screen.getByText('Guardando…')).toBeInTheDocument();
    expect(screen.getByLabelText(/Docente/)).toBeDisabled();
    expect(screen.getByLabelText(/Director de Programa/)).toBeDisabled();
  });
});
