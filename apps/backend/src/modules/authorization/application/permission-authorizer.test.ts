import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { GrantReader } from '../domain/index.js';
import { PermissionAuthorizer } from './permission-authorizer.js';

describe('PermissionAuthorizer Unit Tests (F4, RS-002, RS-011, RS-012)', () => {
  const actorId = 'actor-user-uuid';

  function createAuthorizer(grants: Array<{ permission: string; scope: 'GLOBAL' | 'OWN' }> = []) {
    const grantReader: GrantReader = {
      findGrantsByUserId: vi.fn().mockResolvedValue(grants),
    };

    const authorizer = new PermissionAuthorizer(grantReader);
    return { authorizer, grantReader };
  }

  it('allows a granted permission', async () => {
    const { authorizer } = createAuthorizer([{ permission: 'usuario.ver', scope: 'GLOBAL' }]);

    await expect(
      authorizer.assertAllowed({
        actorId,
        permission: 'usuario.ver',
        scope: 'GLOBAL',
      }),
    ).resolves.toBeUndefined();
  });

  it('denies when the user has no grants', async () => {
    const { authorizer } = createAuthorizer([]);

    await expect(
      authorizer.assertAllowed({
        actorId,
        permission: 'usuario.ver',
        scope: 'GLOBAL',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('denies an own grant for a global requirement', async () => {
    const { authorizer } = createAuthorizer([{ permission: 'usuario.editar', scope: 'OWN' }]);

    await expect(
      authorizer.assertAllowed({
        actorId,
        permission: 'usuario.editar',
        scope: 'GLOBAL',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('denies an unknown permission code without reading grants (fails closed)', async () => {
    const { authorizer, grantReader } = createAuthorizer([
      { permission: 'usuario.ver', scope: 'GLOBAL' },
    ]);

    await expect(
      authorizer.assertAllowed({
        actorId,
        permission: 'codigo.desconocido',
        scope: 'GLOBAL',
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(grantReader.findGrantsByUserId).not.toHaveBeenCalled();
  });

  it('propagates reader failures without allowing access', async () => {
    const grantReader: GrantReader = {
      findGrantsByUserId: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    };
    const authorizer = new PermissionAuthorizer(grantReader);

    await expect(
      authorizer.assertAllowed({
        actorId,
        permission: 'usuario.ver',
        scope: 'GLOBAL',
      }),
    ).rejects.toThrow('DB connection lost');
  });
});
