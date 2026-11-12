import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserAccessSubjectRepository } from '../domain/ports/user-access-subject-repository.js';
import type { UserRoleRepository } from '../domain/ports/user-role-repository.js';
import type { UserPermissionRepository } from '../domain/ports/user-permission-repository.js';
import type { RolePermissionRepository } from '../domain/ports/role-permission-repository.js';
import { UserAccessAssembler } from './user-access-assembler.js';
import { GetUserEffectiveAccessUseCase } from './get-user-effective-access.js';
import { PermissionAuthorizer } from './permission-authorizer.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { UserAccessSubjectNotFoundError } from '../domain/errors/user-access-subject-not-found-error.js';
import { userAccessSchema } from '@sigoa/shared';

describe('GetUserEffectiveAccessUseCase', () => {
  function setup() {
    const subject = mock<UserAccessSubjectRepository>();
    const roles = mock<UserRoleRepository>();
    const direct = mock<UserPermissionRepository>();
    const rolePermissions = mock<RolePermissionRepository>();
    const authorizer = mock<PermissionAuthorizer>();
    const assembler = new UserAccessAssembler({ roles, direct, rolePermissions });
    const useCase = new GetUserEffectiveAccessUseCase({ subject, authorizer, assembler });
    return { subject, roles, direct, rolePermissions, authorizer, assembler, useCase };
  }

  it('denies access before reading the subject or grants', async () => {
    const { subject, roles, direct, authorizer, useCase } = setup();
    authorizer.assertAllowed.mockRejectedValue(new ForbiddenError());
    await expect(useCase.execute({ actorId: 'actor', userId: 'user' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(subject.findById).not.toHaveBeenCalled();
    expect(roles.findByUserId).not.toHaveBeenCalled();
    expect(direct.findByUserId).not.toHaveBeenCalled();
  });

  it('rejects a missing user before assembling access', async () => {
    const { subject, roles, useCase } = setup();
    subject.findById.mockResolvedValue(null);
    await expect(useCase.execute({ actorId: 'actor', userId: 'missing' })).rejects.toBeInstanceOf(
      UserAccessSubjectNotFoundError,
    );
    expect(roles.findByUserId).not.toHaveBeenCalled();
  });

  it('merges active roles and direct grants while excluding inactive role grants', async () => {
    const { subject, roles, direct, rolePermissions, useCase } = setup();
    subject.findById.mockResolvedValue({ id: 'user', status: 'INACTIVE' });
    roles.findByUserId.mockResolvedValue([
      { roleId: 'one', roleCode: 'ALPHA', roleName: 'Alfa', roleStatus: 'ACTIVE' },
      { roleId: 'two', roleCode: 'BETA', roleName: 'Beta', roleStatus: 'ACTIVE' },
      { roleId: 'old', roleCode: 'OLD', roleName: 'Anterior', roleStatus: 'INACTIVE' },
    ]);
    direct.findByUserId.mockResolvedValue([
      { permissionId: 'permission', permissionCode: 'usuario.ver', scope: 'GLOBAL' },
    ]);
    rolePermissions.findByRoleId.mockResolvedValue([
      { permissionId: 'permission', permissionCode: 'usuario.ver', scope: 'OWN' },
    ]);
    const result = await useCase.execute({ actorId: 'actor', userId: 'user' });
    expect(userAccessSchema.parse(result)).toEqual(result);
    expect(result.roles).toEqual([
      { id: 'one', code: 'ALPHA', name: 'Alfa', status: 'ACTIVE' },
      { id: 'two', code: 'BETA', name: 'Beta', status: 'ACTIVE' },
      { id: 'old', code: 'OLD', name: 'Anterior', status: 'INACTIVE' },
    ]);
    expect(result.directPermissions).toEqual([{ permissionCode: 'usuario.ver', scope: 'GLOBAL' }]);
    expect(result.effectivePermissions).toEqual([
      {
        permissionCode: 'usuario.ver',
        scope: 'GLOBAL',
        sources: [
          { kind: 'ROLE', roleId: 'one', roleCode: 'ALPHA', roleName: 'Alfa', scope: 'OWN' },
          { kind: 'ROLE', roleId: 'two', roleCode: 'BETA', roleName: 'Beta', scope: 'OWN' },
          { kind: 'DIRECT', scope: 'GLOBAL' },
        ],
      },
    ]);
    expect(rolePermissions.findByRoleId).toHaveBeenCalledTimes(2);
    expect(rolePermissions.findByRoleId).not.toHaveBeenCalledWith('old');
  });
  it('returns an empty valid access response after authorization', async () => {
    const subject = mock<UserAccessSubjectRepository>();
    const roles = mock<UserRoleRepository>();
    const direct = mock<UserPermissionRepository>();
    const rolePermissions = mock<RolePermissionRepository>();
    const authorizer = mock<PermissionAuthorizer>();
    subject.findById.mockResolvedValue({ id: 'user', status: 'ACTIVE' });
    roles.findByUserId.mockResolvedValue([]);
    direct.findByUserId.mockResolvedValue([]);
    const assembler = new UserAccessAssembler({ roles, direct, rolePermissions });
    const useCase = new GetUserEffectiveAccessUseCase({ subject, authorizer, assembler });
    await expect(useCase.execute({ actorId: 'actor', userId: 'user' })).resolves.toEqual({
      userId: 'user',
      roles: [],
      directPermissions: [],
      effectivePermissions: [],
    });
    expect(authorizer.assertAllowed).toHaveBeenCalledWith({
      actorId: 'actor',
      permission: 'usuario.ver',
      scope: 'GLOBAL',
    });
    expect(subject.findById).toHaveBeenCalledWith('user');
    expect(vi.mocked(rolePermissions.findByRoleId)).not.toHaveBeenCalled();
  });
});
