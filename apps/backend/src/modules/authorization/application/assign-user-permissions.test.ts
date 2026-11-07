import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserAccessSubjectRepository } from '../domain/ports/user-access-subject-repository.js';
import type { UserPermissionRepository } from '../domain/ports/user-permission-repository.js';
import type { PermissionRepository } from '../domain/ports/permission-repository.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';
import type { UserAccessAssembler } from './user-access-assembler.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { AssignUserPermissionsUseCase } from './assign-user-permissions.js';

describe('AssignUserPermissionsUseCase', () => {
  it('denies before reading the catalog or opening a transaction', async () => {
    const subject = mock<UserAccessSubjectRepository>();
    const direct = mock<UserPermissionRepository>();
    const permissionRepository = mock<PermissionRepository>();
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
    const useCase = new AssignUserPermissionsUseCase({
      subject,
      direct,
      permissionRepository,
      authorizer,
      assembler,
      unitOfWork,
      auditLogger,
    });
    await expect(
      useCase.execute({ actorId: 'actor', userId: 'user', input: { permissions: [] } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(started).toBe(false);
    expect(permissionRepository.findByCodes).not.toHaveBeenCalled();
    expect(subject.lockForUpdate).not.toHaveBeenCalled();
  });
});
