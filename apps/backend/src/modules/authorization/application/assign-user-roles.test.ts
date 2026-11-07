import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { RoleRepository } from '../domain/ports/role-repository.js';
import type { UserRoleRepository } from '../domain/ports/user-role-repository.js';
import type { UserAccessSubjectRepository } from '../domain/ports/user-access-subject-repository.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';
import type { UserAccessAssembler } from './user-access-assembler.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { AssignUserRolesUseCase } from './assign-user-roles.js';
import { Role } from '../domain/entities/role.js';
import { InvalidUserAccessDataError } from '../domain/errors/invalid-user-access-data-error.js';
import { ProtectedRoleError } from '../domain/errors/protected-role-error.js';
import { UserAccessSubjectNotFoundError } from '../domain/errors/user-access-subject-not-found-error.js';

describe('AssignUserRolesUseCase', () => {
  function role(id: string, code: string, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') {
    return Role.restore({
      id,
      code,
      name: code,
      description: null,
      status,
      deactivatedAt: null,
      isPredefined: false,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
  }

  function setup() {
    const subject = mock<UserAccessSubjectRepository>();
    const roles = mock<UserRoleRepository>();
    const roleRepository = mock<RoleRepository>();
    const authorizer = mock<PermissionAuthorizer>();
    const assembler = mock<UserAccessAssembler>();
    const auditLogger = mock<AuditLogger>();
    const unitOfWork = { run: async <T>(work: () => Promise<T>) => work() };
    const admin = role('admin', 'ADMINISTRATOR');
    const active = role('active', 'TEACHER');
    const inactive = role('old', 'OLD', 'INACTIVE');
    roleRepository.findByCode.mockResolvedValue(admin);
    roleRepository.findByIdForUpdate.mockResolvedValue(admin);
    roleRepository.findById.mockImplementation(
      async (id) => [admin, active, inactive].find((item) => item.id === id) ?? null,
    );
    subject.lockForUpdate.mockResolvedValue({ id: 'user', status: 'ACTIVE' });
    roles.findByUserId.mockResolvedValue([]);
    roles.countActiveHolders.mockResolvedValue(0);
    roles.replaceForUser.mockResolvedValue({ added: ['active'], removed: [] });
    assembler.build.mockResolvedValue({
      userId: 'user',
      roles: [],
      directPermissions: [],
      effectivePermissions: [],
    });
    const useCase = new AssignUserRolesUseCase({
      subject,
      roles,
      roleRepository,
      authorizer,
      assembler,
      unitOfWork,
      auditLogger,
    });
    const command = (roleIds: string[]) => ({
      actorId: 'actor',
      userId: 'user',
      input: { roleIds },
    });
    return { subject, roles, roleRepository, authorizer, assembler, auditLogger, useCase, command };
  }

  it('rejects duplicates before locking and rejects missing users and roles', async () => {
    const a = setup();
    await expect(a.useCase.execute(a.command(['active', 'active']))).rejects.toBeInstanceOf(
      InvalidUserAccessDataError,
    );
    expect(a.roleRepository.findByCode).not.toHaveBeenCalled();
    const b = setup();
    b.subject.lockForUpdate.mockResolvedValue(null);
    await expect(b.useCase.execute(b.command(['active']))).rejects.toBeInstanceOf(
      UserAccessSubjectNotFoundError,
    );
    const c = setup();
    await expect(c.useCase.execute(c.command(['missing']))).rejects.toBeInstanceOf(
      InvalidUserAccessDataError,
    );
    expect(c.roles.replaceForUser).not.toHaveBeenCalled();
  });

  it('rejects a newly assigned inactive role but preserves an existing one', async () => {
    const denied = setup();
    await expect(denied.useCase.execute(denied.command(['old']))).rejects.toBeInstanceOf(
      InvalidUserAccessDataError,
    );
    const allowed = setup();
    allowed.roles.findByUserId.mockResolvedValue([
      { roleId: 'old', roleCode: 'OLD', roleName: 'Anterior', roleStatus: 'INACTIVE' },
    ]);
    allowed.roles.replaceForUser.mockResolvedValue({ added: [], removed: [] });
    await expect(allowed.useCase.execute(allowed.command(['old']))).resolves.toEqual({
      userId: 'user',
      roles: [],
      directPermissions: [],
      effectivePermissions: [],
    });
    expect(allowed.auditLogger.log).not.toHaveBeenCalled();
  });

  it('blocks removal from the last active administrator', async () => {
    const context = setup();
    context.roles.findByUserId.mockResolvedValue([
      {
        roleId: 'admin',
        roleCode: 'ADMINISTRATOR',
        roleName: 'Administrador',
        roleStatus: 'ACTIVE',
      },
    ]);
    await expect(context.useCase.execute(context.command(['active']))).rejects.toBeInstanceOf(
      ProtectedRoleError,
    );
    expect(context.roles.countActiveHolders).toHaveBeenCalledWith('admin', 'user');
    expect(context.roles.replaceForUser).not.toHaveBeenCalled();
    expect(context.auditLogger.log).not.toHaveBeenCalled();
  });

  it.each(['ACTIVE', 'INACTIVE'] as const)(
    'allows administrator removal for %s when the safeguard permits it',
    async (status) => {
      const context = setup();
      context.subject.lockForUpdate.mockResolvedValue({ id: 'user', status });
      context.roles.findByUserId.mockResolvedValue([
        {
          roleId: 'admin',
          roleCode: 'ADMINISTRATOR',
          roleName: 'Administrador',
          roleStatus: 'ACTIVE',
        },
      ]);
      context.roles.countActiveHolders.mockResolvedValue(1);
      context.roles.replaceForUser.mockResolvedValue({ added: ['active'], removed: ['admin'] });
      await context.useCase.execute(context.command(['active']));
      expect(context.auditLogger.log).toHaveBeenCalledWith({
        action: 'ROLE_CHANGE',
        entity: 'User',
        entityId: 'user',
        actor: 'actor',
        ip: undefined,
        before: { roles: [{ id: 'admin', code: 'ADMINISTRATOR' }] },
        after: { roles: [{ id: 'active', code: 'TEACHER' }] },
      });
      expect(context.roleRepository.findByIdForUpdate.mock.invocationCallOrder[0]).toBeLessThan(
        context.subject.lockForUpdate.mock.invocationCallOrder[0]!,
      );
      if (status === 'INACTIVE') expect(context.roles.countActiveHolders).not.toHaveBeenCalled();
    },
  );

  it('does not audit an unchanged set and propagates audit failures', async () => {
    const same = setup();
    same.roles.replaceForUser.mockResolvedValue({ added: [], removed: [] });
    await same.useCase.execute(same.command(['active']));
    expect(same.auditLogger.log).not.toHaveBeenCalled();
    const failed = setup();
    failed.auditLogger.log.mockRejectedValue(new Error('audit failed'));
    await expect(failed.useCase.execute(failed.command(['active']))).rejects.toThrow(
      'audit failed',
    );
    expect(failed.assembler.build).not.toHaveBeenCalled();
  });

  it('replaces a user access set with two roles and audits only ids and codes', async () => {
    const context = setup();
    context.roles.replaceForUser.mockResolvedValue({ added: ['active', 'admin'], removed: [] });
    await context.useCase.execute(context.command(['active', 'admin']));
    expect(context.roles.replaceForUser).toHaveBeenCalledWith('user', ['active', 'admin'], 'actor');
    expect(context.auditLogger.log).toHaveBeenCalledWith({
      action: 'ROLE_CHANGE',
      entity: 'User',
      entityId: 'user',
      actor: 'actor',
      ip: undefined,
      before: { roles: [] },
      after: {
        roles: [
          { id: 'admin', code: 'ADMINISTRATOR' },
          { id: 'active', code: 'TEACHER' },
        ],
      },
    });
  });
  it('denies before starting a transaction or reading the user', async () => {
    const subject = mock<UserAccessSubjectRepository>();
    const roles = mock<UserRoleRepository>();
    const roleRepository = mock<RoleRepository>();
    const authorizer = mock<PermissionAuthorizer>();
    const assembler = mock<UserAccessAssembler>();
    const auditLogger = mock<AuditLogger>();
    let started = false;
    const unitOfWork = {
      run: async <T>(work: () => Promise<T>) => {
        started = true;
        return work();
      },
    };
    authorizer.assertAllowed.mockRejectedValue(new ForbiddenError());
    const useCase = new AssignUserRolesUseCase({
      subject,
      roles,
      roleRepository,
      authorizer,
      assembler,
      unitOfWork,
      auditLogger,
    });
    await expect(
      useCase.execute({ actorId: 'actor', userId: 'user', input: { roleIds: ['role'] } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(started).toBe(false);
    expect(subject.lockForUpdate).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
