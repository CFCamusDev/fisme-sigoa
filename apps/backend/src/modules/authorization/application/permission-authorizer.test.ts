import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { AccessDenial, AccessDenialRecorder, GrantReader } from '../domain/index.js';
import { PermissionAuthorizer } from './permission-authorizer.js';

describe('PermissionAuthorizer Unit Tests (F4, RS-002, RS-011, RS-012, RF-008)', () => {
  const actorId = 'actor-user-uuid';

  function createAuthorizer(grants: Array<{ permission: string; scope: 'GLOBAL' | 'OWN' }> = []) {
    const recordedDenials: AccessDenial[] = [];
    const grantReader: GrantReader = {
      findGrantsByUserId: vi.fn().mockResolvedValue(grants),
    };
    const recorder: AccessDenialRecorder = {
      record: vi.fn(async (denial: AccessDenial) => {
        recordedDenials.push(denial);
      }),
    };

    const authorizer = new PermissionAuthorizer(grantReader, recorder);
    return { authorizer, grantReader, recorder, recordedDenials };
  }

  it('allows a granted permission without recording a denial', async () => {
    const { authorizer, recordedDenials } = createAuthorizer([
      { permission: 'usuario.ver', scope: 'GLOBAL' },
    ]);

    await expect(
      authorizer.assertAllowed({
        actorId,
        permission: 'usuario.ver',
        scope: 'GLOBAL',
      }),
    ).resolves.toBeUndefined();
    expect(recordedDenials).toHaveLength(0);
  });

  it('records an ACCESS_DENIED audit event before rejecting when the user lacks the permission', async () => {
    const { authorizer, recordedDenials } = createAuthorizer([]);

    await expect(
      authorizer.assertAllowed({
        actorId,
        permission: 'usuario.ver',
        scope: 'GLOBAL',
        meta: { method: 'GET', route: '/users' },
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(recordedDenials).toEqual([
      {
        actorId,
        permission: 'usuario.ver',
        requiredScope: 'GLOBAL',
        grantedScope: null,
        reason: 'MISSING_PERMISSION',
        method: 'GET',
        route: '/users',
      },
    ]);
  });

  it('records SCOPE_INSUFFICIENT when an own grant is evaluated against a global requirement', async () => {
    const { authorizer, recordedDenials } = createAuthorizer([
      { permission: 'usuario.editar', scope: 'OWN' },
    ]);

    await expect(
      authorizer.assertAllowed({
        actorId,
        permission: 'usuario.editar',
        scope: 'GLOBAL',
        meta: { method: 'PATCH', route: '/users/:id' },
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(recordedDenials).toEqual([
      {
        actorId,
        permission: 'usuario.editar',
        requiredScope: 'GLOBAL',
        grantedScope: 'OWN',
        reason: 'SCOPE_INSUFFICIENT',
        method: 'PATCH',
        route: '/users/:id',
      },
    ]);
  });

  it('accepts a direct OWN grant for OWN scope and rejects it for GLOBAL scope', async () => {
    const { authorizer, recordedDenials } = createAuthorizer([
      { permission: 'usuario.ver', scope: 'OWN' },
    ]);
    await expect(
      authorizer.assertAllowed({ actorId, permission: 'usuario.ver', scope: 'OWN' }),
    ).resolves.toBeUndefined();
    expect(recordedDenials).toHaveLength(0);

    await expect(
      authorizer.assertAllowed({ actorId, permission: 'usuario.ver', scope: 'GLOBAL' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(recordedDenials).toHaveLength(1);
    expect(recordedDenials[0]?.reason).toBe('SCOPE_INSUFFICIENT');
  });

  it('denies an unknown permission code without reading grants and records UNKNOWN_PERMISSION (fails closed)', async () => {
    const { authorizer, grantReader, recordedDenials } = createAuthorizer([
      { permission: 'usuario.ver', scope: 'GLOBAL' },
    ]);

    await expect(
      authorizer.assertAllowed({
        actorId,
        permission: 'codigo.desconocido',
        scope: 'GLOBAL',
        meta: { method: 'POST', route: '/unknown' },
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(grantReader.findGrantsByUserId).not.toHaveBeenCalled();
    expect(recordedDenials).toEqual([
      {
        actorId,
        permission: 'codigo.desconocido',
        requiredScope: 'GLOBAL',
        grantedScope: null,
        reason: 'UNKNOWN_PERMISSION',
        method: 'POST',
        route: '/unknown',
      },
    ]);
  });

  it('still rejects with 403 when the audit write fails (D4)', async () => {
    const grantReader: GrantReader = {
      findGrantsByUserId: vi.fn().mockResolvedValue([]),
    };
    const recorder: AccessDenialRecorder = {
      record: vi.fn().mockRejectedValue(new Error('Audit DB failure')),
    };
    const authorizer = new PermissionAuthorizer(grantReader, recorder);

    await expect(
      authorizer.assertAllowed({
        actorId,
        permission: 'usuario.ver',
        scope: 'GLOBAL',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('records one denial per rejected call under 20 simultaneous callers', async () => {
    const { authorizer, recordedDenials } = createAuthorizer([]);

    const calls = Array.from({ length: 20 }, (_, idx) =>
      authorizer.assertAllowed({
        actorId: `actor-${idx}`,
        permission: 'usuario.crear',
        scope: 'GLOBAL',
        meta: { method: 'POST', route: '/users' },
      }),
    );

    const results = await Promise.allSettled(calls);

    expect(results).toHaveLength(20);
    for (const res of results) {
      expect(res.status).toBe('rejected');
      if (res.status === 'rejected') {
        expect(res.reason).toBeInstanceOf(ForbiddenError);
      }
    }
    expect(recordedDenials).toHaveLength(20);
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
