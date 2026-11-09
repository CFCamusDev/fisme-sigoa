import { describe, it, expect, vi } from 'vitest';
import type { Grant } from '../../domain/policies/effective-permissions.js';
import type { GrantReader } from '../../domain/ports/grant-reader.js';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { CachingGrantReader } from './caching-grant-reader.js';

describe('CachingGrantReader', () => {
  const createMockGrantReader = (impl?: (userId: string) => Promise<Grant[]>): GrantReader => ({
    findGrantsByUserId: vi.fn(
      impl ??
        (async (userId: string) => [
          { permission: 'usuario.ver', scope: 'GLOBAL' as const, userId },
        ]),
    ),
  });

  const sampleGrant = (code: string): Grant => ({
    permission: code,
    scope: 'GLOBAL',
  });

  it('shares one in-flight read between 20 simultaneous callers', async () => {
    let callCount = 0;
    let resolvePromise: (grants: Grant[]) => void;
    const pending = new Promise<Grant[]>((resolve) => {
      resolvePromise = resolve;
    });

    const underlying: GrantReader = {
      findGrantsByUserId: vi.fn().mockImplementation(async () => {
        callCount++;
        return pending;
      }),
    };

    const cache = new CachingGrantReader(underlying);

    const calls = Array.from({ length: 20 }, () => cache.findGrantsByUserId('user-1'));
    resolvePromise!([sampleGrant('usuario.ver')]);
    const results = await Promise.all(calls);

    expect(callCount).toBe(1);
    expect(results).toHaveLength(20);
    for (const res of results) {
      expect(res).toEqual([sampleGrant('usuario.ver')]);
    }
  });

  it('discards a read that started before an invalidation', async () => {
    let callCount = 0;
    let resolveFirstRead: (grants: Grant[]) => void;
    const firstReadPromise = new Promise<Grant[]>((resolve) => {
      resolveFirstRead = resolve;
    });

    const underlying: GrantReader = {
      findGrantsByUserId: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return firstReadPromise;
        }
        return [sampleGrant('usuario.editar')];
      }),
    };

    const cache = new CachingGrantReader(underlying);

    // Inicia lectura 1
    const read1 = cache.findGrantsByUserId('user-1');

    // Invalida usuario mientras la lectura 1 está en vuelo
    cache.invalidateUser('user-1');

    // Resuelve la lectura 1 (debe descartarse para la caché)
    resolveFirstRead!([sampleGrant('usuario.ver')]);
    const res1 = await read1;
    expect(res1).toEqual([sampleGrant('usuario.ver')]);

    // La lectura siguiente debe consultar nuevamente la base (no reutilizar el resultado viejo descartado)
    const res2 = await cache.findGrantsByUserId('user-1');
    expect(res2).toEqual([sampleGrant('usuario.editar')]);
    expect(callCount).toBe(2);
  });

  it('discards a read that started before invalidateAll', async () => {
    let callCount = 0;
    let resolveFirstRead: (grants: Grant[]) => void;
    const firstReadPromise = new Promise<Grant[]>((resolve) => {
      resolveFirstRead = resolve;
    });

    const underlying: GrantReader = {
      findGrantsByUserId: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return firstReadPromise;
        }
        return [sampleGrant('permiso.asignar')];
      }),
    };

    const cache = new CachingGrantReader(underlying);

    const read1 = cache.findGrantsByUserId('user-1');
    cache.invalidateAll();

    resolveFirstRead!([sampleGrant('usuario.ver')]);
    await read1;

    const res2 = await cache.findGrantsByUserId('user-1');
    expect(res2).toEqual([sampleGrant('permiso.asignar')]);
    expect(callCount).toBe(2);
  });

  it('does not cache inside a transaction', async () => {
    let inTransaction = false;
    const dbProvider: DbProvider = {
      get: () => ({}) as unknown as ReturnType<DbProvider['get']>,
      isInTransaction: () => inTransaction,
    };

    const underlying = createMockGrantReader();
    const cache = new CachingGrantReader(underlying, dbProvider);

    // Fuera de transacción: cachea
    await cache.findGrantsByUserId('user-1');
    await cache.findGrantsByUserId('user-1');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(1);

    // Dentro de transacción: no cachea y no consulta caché
    inTransaction = true;
    await cache.findGrantsByUserId('user-1');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(2);

    await cache.findGrantsByUserId('user-1');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(3);

    // Al salir de transacción: vuelve a usar el valor en caché
    inTransaction = false;
    await cache.findGrantsByUserId('user-1');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(3);
  });

  it('expires entries after the ttl', async () => {
    let currentTime = 1000;
    const now = () => currentTime;

    const underlying = createMockGrantReader();
    const cache = new CachingGrantReader(underlying, undefined, {
      ttlMs: 500,
      now,
    });

    await cache.findGrantsByUserId('user-1');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(1);

    // A los 400 ms sigue vigente
    currentTime = 1400;
    await cache.findGrantsByUserId('user-1');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(1);

    // A los 501 ms expiró
    currentTime = 1501;
    await cache.findGrantsByUserId('user-1');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest user when full', async () => {
    const underlying = createMockGrantReader();
    const cache = new CachingGrantReader(underlying, undefined, {
      maxEntries: 2,
    });

    await cache.findGrantsByUserId('user-1');
    await cache.findGrantsByUserId('user-2');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(2);

    // user-1 y user-2 están en caché
    await cache.findGrantsByUserId('user-1');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(2);

    // user-3 desaloja al más antiguo (user-2, dado que user-1 fue accedido recientemente)
    await cache.findGrantsByUserId('user-3');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(3);

    // user-1 sigue en caché
    await cache.findGrantsByUserId('user-1');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(3);

    // user-2 fue desalojado, debe reconsultar
    await cache.findGrantsByUserId('user-2');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(4);
  });

  it('does not cache failures', async () => {
    let fail = true;
    const underlying: GrantReader = {
      findGrantsByUserId: vi.fn().mockImplementation(async () => {
        if (fail) {
          throw new Error('Database connection failed');
        }
        return [sampleGrant('usuario.ver')];
      }),
    };

    const cache = new CachingGrantReader(underlying);

    await expect(cache.findGrantsByUserId('user-1')).rejects.toThrow('Database connection failed');

    // La siguiente llamada exitosa no debe recordar el error previo
    fail = false;
    const result = await cache.findGrantsByUserId('user-1');
    expect(result).toEqual([sampleGrant('usuario.ver')]);
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(2);
  });

  it('disables cache completely when ttlMs is 0', async () => {
    const underlying = createMockGrantReader();
    const cache = new CachingGrantReader(underlying, undefined, {
      ttlMs: 0,
    });

    await cache.findGrantsByUserId('user-1');
    await cache.findGrantsByUserId('user-1');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(2);
  });

  it('invalidateUser only invalidates target user and preserves other cached users', async () => {
    const underlying = createMockGrantReader();
    const cache = new CachingGrantReader(underlying);

    await cache.findGrantsByUserId('user-1');
    await cache.findGrantsByUserId('user-2');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(2);

    cache.invalidateUser('user-1');

    // user-2 sigue en caché
    await cache.findGrantsByUserId('user-2');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(2);

    // user-1 consulta nuevamente
    await cache.findGrantsByUserId('user-1');
    expect(underlying.findGrantsByUserId).toHaveBeenCalledTimes(3);
  });
});
