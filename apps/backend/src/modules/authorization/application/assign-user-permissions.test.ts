import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserAccessSubjectRepository } from '../domain/ports/user-access-subject-repository.js';
import type { UserPermissionRepository } from '../domain/ports/user-permission-repository.js';
import type { PermissionRepository } from '../domain/ports/permission-repository.js';
import type { PermissionCacheInvalidator } from '../domain/ports/permission-cache-invalidator.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';
import type { UserAccessAssembler } from './user-access-assembler.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { AssignUserPermissionsUseCase } from './assign-user-permissions.js';
import { InvalidUserAccessDataError } from '../domain/errors/invalid-user-access-data-error.js';
import { UserAccessSubjectNotFoundError } from '../domain/errors/user-access-subject-not-found-error.js';

describe('AssignUserPermissionsUseCase', () => {
  function setup() {
    const subject = mock<UserAccessSubjectRepository>();
    const direct = mock<UserPermissionRepository>();
    const permissionRepository = mock<PermissionRepository>();
    const authorizer = mock<PermissionAuthorizer>();
    const assembler = mock<UserAccessAssembler>();
    const auditLogger = mock<AuditLogger>();
    const permissionCache = mock<PermissionCacheInvalidator>();
    const runMock = vi.fn(async <T>(work: () => Promise<T>) => work());
    const unitOfWork: UnitOfWork = { run: runMock as unknown as UnitOfWork['run'] };
    subject.lockForUpdate.mockResolvedValue({ id: 'user', status: 'ACTIVE' });
    direct.findByUserId.mockResolvedValue([]);
    direct.replaceForUser.mockResolvedValue({ added: 1, updated: 0, removed: 0 });
    permissionRepository.findByCodes.mockImplementation(async (codes) =>
      codes
        .filter((code) => ['rol.ver', 'usuario.ver'].includes(code))
        .map((code) => ({ id: `id-${code}`, code, description: 'Prueba', module: 'Prueba' })),
    );
    assembler.build.mockResolvedValue({
      userId: 'user',
      roles: [],
      directPermissions: [],
      effectivePermissions: [],
    });
    const useCase = new AssignUserPermissionsUseCase({
      subject,
      direct,
      permissionRepository,
      authorizer,
      assembler,
      unitOfWork,
      auditLogger,
      permissionCache,
    });
    return {
      subject,
      direct,
      permissionRepository,
      authorizer,
      assembler,
      auditLogger,
      unitOfWork,
      runMock,
      permissionCache,
      useCase,
    };
  }

  it('rejects duplicate and unknown codes before locking', async () => {
    const duplicate = setup();
    await expect(
      duplicate.useCase.execute({
        actorId: 'actor',
        userId: 'user',
        input: {
          permissions: [
            { permissionCode: 'rol.ver', scope: 'OWN' },
            { permissionCode: 'rol.ver', scope: 'GLOBAL' },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(InvalidUserAccessDataError);
    expect(duplicate.permissionRepository.findByCodes).not.toHaveBeenCalled();
    const unknown = setup();
    await expect(
      unknown.useCase.execute({
        actorId: 'actor',
        userId: 'user',
        input: { permissions: [{ permissionCode: 'otro.ver', scope: 'OWN' }] },
      }),
    ).rejects.toBeInstanceOf(InvalidUserAccessDataError);
    expect(unknown.subject.lockForUpdate).not.toHaveBeenCalled();
  });

  it('rejects a missing user without replacing permissions', async () => {
    const context = setup();
    context.subject.lockForUpdate.mockResolvedValue(null);
    await expect(
      context.useCase.execute({ actorId: 'actor', userId: 'missing', input: { permissions: [] } }),
    ).rejects.toBeInstanceOf(UserAccessSubjectNotFoundError);
    expect(context.direct.replaceForUser).not.toHaveBeenCalled();
  });

  it('assigns OWN and GLOBAL grants and audits only sorted permission codes and scopes', async () => {
    const context = setup();
    context.direct.findByUserId.mockResolvedValue([
      { permissionId: 'old', permissionCode: 'usuario.ver', scope: 'OWN' },
    ]);
    context.direct.replaceForUser.mockResolvedValue({ added: 1, updated: 1, removed: 0 });
    const permissions = [
      { permissionCode: 'usuario.ver', scope: 'GLOBAL' as const },
      { permissionCode: 'rol.ver', scope: 'OWN' as const },
    ];
    await context.useCase.execute({ actorId: 'actor', userId: 'user', input: { permissions } });
    expect(context.authorizer.assertAllowed).toHaveBeenCalledWith({
      actorId: 'actor',
      permission: 'permiso.asignar',
      scope: 'GLOBAL',
    });
    expect(context.direct.replaceForUser).toHaveBeenCalledWith(
      'user',
      [
        { permissionId: 'id-usuario.ver', scope: 'GLOBAL' },
        { permissionId: 'id-rol.ver', scope: 'OWN' },
      ],
      'actor',
    );
    expect(context.auditLogger.log).toHaveBeenCalledWith({
      action: 'PERMISSION_CHANGE',
      entity: 'User',
      entityId: 'user',
      actor: 'actor',
      ip: undefined,
      before: { permissions: [{ permissionCode: 'usuario.ver', scope: 'OWN' }] },
      after: {
        permissions: [
          { permissionCode: 'rol.ver', scope: 'OWN' },
          { permissionCode: 'usuario.ver', scope: 'GLOBAL' },
        ],
      },
    });
  });

  it('removes every direct grant for an empty set and does not audit an unchanged set', async () => {
    const removed = setup();
    removed.direct.findByUserId.mockResolvedValue([
      { permissionId: 'old', permissionCode: 'rol.ver', scope: 'OWN' },
    ]);
    removed.direct.replaceForUser.mockResolvedValue({ added: 0, updated: 0, removed: 1 });
    await removed.useCase.execute({ actorId: 'actor', userId: 'user', input: { permissions: [] } });
    expect(removed.permissionRepository.findByCodes).not.toHaveBeenCalled();
    expect(removed.direct.replaceForUser).toHaveBeenCalledWith('user', [], 'actor');
    expect(removed.auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        before: { permissions: [{ permissionCode: 'rol.ver', scope: 'OWN' }] },
        after: { permissions: [] },
      }),
    );
    const same = setup();
    same.direct.replaceForUser.mockResolvedValue({ added: 0, updated: 0, removed: 0 });
    await same.useCase.execute({ actorId: 'actor', userId: 'user', input: { permissions: [] } });
    expect(same.auditLogger.log).not.toHaveBeenCalled();
  });

  it('propagates audit failures before building the response', async () => {
    const context = setup();
    context.auditLogger.log.mockRejectedValue(new Error('audit failed'));
    await expect(
      context.useCase.execute({
        actorId: 'actor',
        userId: 'user',
        input: { permissions: [{ permissionCode: 'rol.ver', scope: 'OWN' }] },
      }),
    ).rejects.toThrow('audit failed');
    expect(context.assembler.build).not.toHaveBeenCalled();
  });
  it('denies before reading the catalog or opening a transaction', async () => {
    const subject = mock<UserAccessSubjectRepository>();
    const direct = mock<UserPermissionRepository>();
    const permissionRepository = mock<PermissionRepository>();
    const authorizer = mock<PermissionAuthorizer>();
    const assembler = mock<UserAccessAssembler>();
    const auditLogger = mock<AuditLogger>();
    const permissionCache = mock<PermissionCacheInvalidator>();
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
      permissionCache,
    });
    await expect(
      useCase.execute({ actorId: 'actor', userId: 'user', input: { permissions: [] } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(started).toBe(false);
    expect(permissionRepository.findByCodes).not.toHaveBeenCalled();
    expect(subject.lockForUpdate).not.toHaveBeenCalled();
  });

  it('invalidates target user in permission cache after committing when permissions change', async () => {
    const { useCase, permissionCache, runMock } = setup();
    const callOrder: string[] = [];

    runMock.mockImplementation(async (work: () => Promise<unknown>) => {
      callOrder.push('uow.run');
      return work();
    });
    permissionCache.invalidateUser.mockImplementation(() => {
      callOrder.push('cache.invalidateUser');
    });

    await useCase.execute({
      actorId: 'actor',
      userId: 'user',
      input: { permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }] },
    });

    expect(permissionCache.invalidateUser).toHaveBeenCalledWith('user');
    expect(callOrder).toEqual(['uow.run', 'cache.invalidateUser']);
  });

  it('does not invalidate the cache when permissions do not change', async () => {
    const { useCase, direct, permissionCache } = setup();
    direct.replaceForUser.mockResolvedValueOnce({ added: 0, updated: 0, removed: 0 });

    await useCase.execute({
      actorId: 'actor',
      userId: 'user',
      input: { permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }] },
    });

    expect(permissionCache.invalidateUser).not.toHaveBeenCalled();
  });

  it('does not invalidate the cache if transaction fails', async () => {
    const { useCase, runMock, permissionCache } = setup();
    runMock.mockRejectedValueOnce(new Error('DB failure'));

    await expect(
      useCase.execute({
        actorId: 'actor',
        userId: 'user',
        input: { permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }] },
      }),
    ).rejects.toThrow('DB failure');

    expect(permissionCache.invalidateUser).not.toHaveBeenCalled();
  });
});
