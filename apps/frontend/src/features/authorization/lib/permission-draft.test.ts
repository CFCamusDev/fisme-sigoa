import { describe, expect, it } from 'vitest';
import type { PermissionDto, RoleDto } from '@sigoa/shared';
import {
  buildDraft,
  countChanges,
  groupByModule,
  setScope,
  toUpdateRequest,
} from './permission-draft';

const mockCatalog: PermissionDto[] = [
  {
    code: 'usuario.ver',
    description: 'Ver usuarios',
    module: 'M01 Seguridad',
  },
  {
    code: 'usuario.crear',
    description: 'Crear usuarios',
    module: 'M01 Seguridad',
  },
  {
    code: 'rol.ver',
    description: 'Ver roles',
    module: 'M01 Seguridad',
  },
  {
    code: 'catalogo.ver',
    description: 'Ver catálogo OE/AG',
    module: 'M02 Catálogo',
  },
  {
    code: 'evidencia.subir',
    description: 'Subir evidencia',
    module: 'M05 Evidencias',
  },
];

const mockRole: RoleDto = {
  id: 'role-test',
  code: 'DOCENTE',
  name: 'Docente',
  description: 'Docente evaluador',
  isPredefined: false,
  status: 'ACTIVE',
  deactivatedAt: null,
  userCount: 3,
  permissions: [
    { permissionCode: 'usuario.ver', scope: 'GLOBAL' },
    { permissionCode: 'evidencia.subir', scope: 'OWN' },
  ],
  updatedAt: '2026-11-06T12:00:00.000Z',
};

describe('Permission Draft Model (T-006-22a)', () => {
  it('builds a draft from the role grants and the catalog', () => {
    const draft = buildDraft(mockRole, mockCatalog);

    expect(draft['usuario.ver']).toBe('GLOBAL');
    expect(draft['evidencia.subir']).toBe('OWN');
    expect(draft['usuario.crear']).toBe('NONE');
    expect(draft['rol.ver']).toBe('NONE');
    expect(draft['catalogo.ver']).toBe('NONE');
  });

  it('sets and clears a scope', () => {
    const initialDraft = buildDraft(mockRole, mockCatalog);

    const updated = setScope(initialDraft, 'usuario.crear', 'GLOBAL');
    expect(updated['usuario.crear']).toBe('GLOBAL');
    expect(initialDraft['usuario.crear']).toBe('NONE'); // Inmutabilidad

    const cleared = setScope(updated, 'usuario.ver', 'NONE');
    expect(cleared['usuario.ver']).toBe('NONE');
  });

  it('counts changes against the saved grants', () => {
    const baseDraft = buildDraft(mockRole, mockCatalog);

    expect(countChanges(baseDraft, baseDraft)).toBe(0);

    let current = setScope(baseDraft, 'usuario.crear', 'GLOBAL');
    expect(countChanges(baseDraft, current)).toBe(1);

    current = setScope(current, 'usuario.ver', 'OWN');
    expect(countChanges(baseDraft, current)).toBe(2);

    current = setScope(current, 'usuario.ver', 'GLOBAL'); // Se revierte a lo base
    expect(countChanges(baseDraft, current)).toBe(1);
  });

  it('builds an update request with only granted permissions sorted by code', () => {
    const draft = buildDraft(mockRole, mockCatalog);
    // Agregamos en desorden
    const modified = setScope(setScope(draft, 'catalogo.ver', 'GLOBAL'), 'usuario.crear', 'OWN');

    const request = toUpdateRequest(modified);

    expect(request.permissions).toEqual([
      { permissionCode: 'catalogo.ver', scope: 'GLOBAL' },
      { permissionCode: 'evidencia.subir', scope: 'OWN' },
      { permissionCode: 'usuario.crear', scope: 'OWN' },
      { permissionCode: 'usuario.ver', scope: 'GLOBAL' },
    ]);
  });

  it('groups the catalog by module in order', () => {
    const grouped = groupByModule(mockCatalog);

    const moduleNames = Object.keys(grouped);
    expect(moduleNames).toEqual(['M01 Seguridad', 'M02 Catálogo', 'M05 Evidencias']);

    expect(grouped['M01 Seguridad']).toHaveLength(3);
    expect(grouped['M02 Catálogo']).toHaveLength(1);
    expect(grouped['M05 Evidencias']).toHaveLength(1);
  });

  it('ignores a granted code missing from the catalog', () => {
    const roleWithOrphanGrant: RoleDto = {
      ...mockRole,
      permissions: [
        ...mockRole.permissions,
        { permissionCode: 'permiso.inexistente', scope: 'GLOBAL' },
      ],
    };

    const draft = buildDraft(roleWithOrphanGrant, mockCatalog);

    expect(draft['permiso.inexistente']).toBeUndefined();
    expect(draft['usuario.ver']).toBe('GLOBAL');
  });
});
