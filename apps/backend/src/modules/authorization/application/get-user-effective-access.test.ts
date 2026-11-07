import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserAccessSubjectRepository } from '../domain/ports/user-access-subject-repository.js';
import type { UserRoleRepository } from '../domain/ports/user-role-repository.js';
import type { UserPermissionRepository } from '../domain/ports/user-permission-repository.js';
import type { RolePermissionRepository } from '../domain/ports/role-permission-repository.js';
import { UserAccessAssembler } from './user-access-assembler.js';
import { GetUserEffectiveAccessUseCase } from './get-user-effective-access.js';
import { PermissionAuthorizer } from './permission-authorizer.js';

describe('GetUserEffectiveAccessUseCase', () => {
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
