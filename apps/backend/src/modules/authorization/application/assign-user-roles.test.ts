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

describe('AssignUserRolesUseCase', () => {
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
