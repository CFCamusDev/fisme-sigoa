import { describe, expect, it, vi } from 'vitest';
import { createRoleAccountCache } from '../e2e/support/seed-cache';

describe('e2e role account cache (HU-080, T-080-17)', () => {
  it('seeds a role account once under concurrent calls', async () => {
    let resolveSeed: (() => void) | undefined;
    const seedFn = vi.fn(
      () =>
        new Promise<{ id: string; email: string }>((resolve) => {
          resolveSeed = () => resolve({ id: 'u-1', email: 'e2e-administrator-w0@example.test' });
        }),
    );

    const cache = createRoleAccountCache(seedFn);

    const p1 = cache.getAccount({ workerIndex: 0, overrides: { roles: ['ADMINISTRATOR'] } });
    const p2 = cache.getAccount({ workerIndex: 0 });
    const p3 = cache.getAccount({ workerIndex: 0, overrides: { roles: ['ADMINISTRATOR'] } });

    expect(seedFn).toHaveBeenCalledTimes(1);
    resolveSeed?.();

    const [a1, a2, a3] = await Promise.all([p1, p2, p3]);
    expect(a1).toEqual(a2);
    expect(a2).toEqual(a3);
    expect(a1.email).toBe('e2e-administrator-w0@example.test');

    // Llamadas posteriores y con otro orden de roles reutilizan la misma cuenta
    const p4 = cache.getAccount({
      workerIndex: 0,
      overrides: { roles: ['COORDINATOR', 'TEACHER'] },
    });
    const p5 = cache.getAccount({
      workerIndex: 0,
      overrides: { roles: ['TEACHER', 'COORDINATOR'] },
    });
    expect(seedFn).toHaveBeenCalledTimes(2);
    resolveSeed?.();
    await Promise.all([p4, p5]);
  });

  it('gives own accounts to overrides that change the user', async () => {
    const seedFn = vi.fn(async (opts: { email: string }) => ({ id: 'u-own', email: opts.email }));
    const cache = createRoleAccountCache(seedFn);

    const a1 = await cache.getAccount({
      workerIndex: 0,
      overrides: { password: 'CustomPassword123!' },
    });
    const a2 = await cache.getAccount({
      workerIndex: 0,
      overrides: { email: 'custom-e2e@example.test', roles: ['ADMINISTRATOR'] },
    });
    const a3 = await cache.getAccount({
      workerIndex: 0,
      overrides: { status: 'INACTIVE' },
    });

    expect(seedFn).toHaveBeenCalledTimes(3);
    expect(a1.email).not.toBe('e2e-administrator-w0@example.test');
    expect(a2.email).toBe('custom-e2e@example.test');
    expect(a3.email).not.toBe(a1.email);
  });
});
