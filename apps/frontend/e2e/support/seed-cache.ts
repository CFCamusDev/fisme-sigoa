import type { SeedUserOptions } from './seeder';

export interface CachedAccount {
  email: string;
  password: string;
}

export type SeedUserFn = (options: SeedUserOptions) => Promise<{ id: string; email: string }>;

const DEFAULT_PASSWORD = 'Password123!';
const DEFAULT_ROLES = ['ADMINISTRATOR'];

function hasAccountOverrides(overrides?: Partial<SeedUserOptions>): boolean {
  if (!overrides) return false;
  return Object.keys(overrides).some(
    (key) => key !== 'roles' && overrides[key as keyof SeedUserOptions] !== undefined,
  );
}

function normalizeRoles(roles?: string[]): string[] {
  const list = roles && roles.length > 0 ? roles : DEFAULT_ROLES;
  return [...new Set(list)].sort();
}

function buildRoleEmail(workerIndex: number, roles: string[]): string {
  const slug = roles.map((r) => r.toLowerCase().replace(/[^a-z0-9]+/g, '-')).join('-');
  return `e2e-${slug}-w${workerIndex}@example.test`;
}

export function createRoleAccountCache(seedUser: SeedUserFn) {
  const inFlight = new Map<string, Promise<CachedAccount>>();
  let ownCounter = 0;

  async function getAccount(params: {
    workerIndex: number;
    overrides?: Partial<SeedUserOptions>;
  }): Promise<CachedAccount> {
    const { workerIndex, overrides } = params;

    if (hasAccountOverrides(overrides)) {
      ownCounter += 1;
      const email =
        overrides?.email ?? `e2e-auth-${Date.now()}-${workerIndex}-${ownCounter}@example.test`;
      const password = overrides?.password ?? DEFAULT_PASSWORD;

      await seedUser({
        email,
        password,
        names: 'Usuario',
        firstSurname: 'Prueba',
        roles: DEFAULT_ROLES,
        status: 'ACTIVE',
        ...overrides,
      });

      return { email, password };
    }

    const roles = normalizeRoles(overrides?.roles);
    const cacheKey = `${workerIndex}:${roles.join(',')}`;
    const existing = inFlight.get(cacheKey);
    if (existing) {
      return existing;
    }

    const email = buildRoleEmail(workerIndex, roles);
    const password = DEFAULT_PASSWORD;

    const promise = seedUser({
      email,
      password,
      names: 'Usuario',
      firstSurname: 'Prueba',
      roles,
      status: 'ACTIVE',
    })
      .then(() => ({ email, password }))
      .catch((err) => {
        inFlight.delete(cacheKey);
        throw err;
      });

    inFlight.set(cacheKey, promise);
    return promise;
  }

  return { getAccount };
}
