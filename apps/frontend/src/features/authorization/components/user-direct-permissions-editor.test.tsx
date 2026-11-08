import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PermissionDto, RoleGrant } from '@sigoa/shared';
import { UserDirectPermissionsEditor } from './user-direct-permissions-editor';

const mockCatalog: PermissionDto[] = [
  {
    code: 'academico.ver',
    description: 'Ver información académica',
    module: 'M09 Gestión Académica',
  },
  {
    code: 'academico.editar',
    description: 'Editar cursos y asignaturas',
    module: 'M09 Gestión Académica',
  },
];

describe('UserDirectPermissionsEditor Component (HU-007, T-007-16)', () => {
  it('renders permission scope table with informational notice and initial grants', () => {
    const directPermissions: RoleGrant[] = [{ permissionCode: 'academico.ver', scope: 'GLOBAL' }];

    render(
      <UserDirectPermissionsEditor
        directPermissions={directPermissions}
        catalog={mockCatalog}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Los permisos del rol se muestran en la vista de permisos efectivos/),
    ).toBeInTheDocument();

    const verSelect = screen.getByLabelText('Acceso a academico.ver') as HTMLSelectElement;
    const editarSelect = screen.getByLabelText('Acceso a academico.editar') as HTMLSelectElement;

    expect(verSelect.value).toBe('GLOBAL');
    expect(editarSelect.value).toBe('NONE');
    expect(screen.getByRole('button', { name: 'Guardar permisos directos' })).toBeDisabled();
  });

  it('marks modified row and enables save button on scope change', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();
    const directPermissions: RoleGrant[] = [];

    render(
      <UserDirectPermissionsEditor
        directPermissions={directPermissions}
        catalog={mockCatalog}
        onSave={handleSave}
      />,
    );

    const editarSelect = screen.getByLabelText('Acceso a academico.editar');
    await user.selectOptions(editarSelect, 'OWN');

    expect(screen.getByText('1 cambio sin guardar')).toBeInTheDocument();
    expect(screen.getByText('Modificado')).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: 'Guardar permisos directos' });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);
    expect(handleSave).toHaveBeenCalledWith([{ permissionCode: 'academico.editar', scope: 'OWN' }]);
  });

  it('discards unsaved changes when discard button is clicked', async () => {
    const user = userEvent.setup();
    const handleDiscard = vi.fn();
    const directPermissions: RoleGrant[] = [{ permissionCode: 'academico.ver', scope: 'GLOBAL' }];

    render(
      <UserDirectPermissionsEditor
        directPermissions={directPermissions}
        catalog={mockCatalog}
        onSave={vi.fn()}
        onDiscard={handleDiscard}
      />,
    );

    const verSelect = screen.getByLabelText('Acceso a academico.ver');
    await user.selectOptions(verSelect, 'NONE');

    expect(screen.getByText('1 cambio sin guardar')).toBeInTheDocument();

    const discardButton = screen.getByRole('button', { name: 'Descartar' });
    await user.click(discardButton);

    expect(handleDiscard).toHaveBeenCalled();
    expect(screen.getByText('0 cambios sin guardar')).toBeInTheDocument();
    expect((verSelect as HTMLSelectElement).value).toBe('GLOBAL');
  });

  it('disables controls and displays loading text while isSaving is true', () => {
    render(
      <UserDirectPermissionsEditor
        directPermissions={[]}
        catalog={mockCatalog}
        onSave={vi.fn()}
        isSaving={true}
      />,
    );

    expect(screen.getByText('Guardando…')).toBeInTheDocument();
    expect(screen.getByLabelText('Acceso a academico.ver')).toBeDisabled();
  });
});
