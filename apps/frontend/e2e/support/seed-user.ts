import { expect, request as playwrightRequest, type Page } from '@playwright/test';
import { createRoleAccountCache } from './seed-cache';
import { getWorkerSeeder, type ActivationTokenSeedOptions, type SeedUserOptions } from './seeder';

export type { ActivationTokenSeedOptions, SeedUserOptions };

export async function seedUser(options: SeedUserOptions): Promise<{ id: string; email: string }> {
  return getWorkerSeeder().seedUser(options);
}

const roleAccountCache = createRoleAccountCache((options) => seedUser(options));

function getWorkerIndex(): number {
  const raw = process.env['E2E_WORKER_INDEX'];
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function loginAsTestUser(
  page: Page,
  overrides?: Partial<SeedUserOptions>,
): Promise<{ email: string; password: string }> {
  const { email, password } = await roleAccountCache.getAccount({
    workerIndex: getWorkerIndex(),
    overrides,
  });

  const apiUrl = process.env['E2E_API_URL'];
  if (!apiUrl) {
    throw new Error('Falta E2E_API_URL para iniciar sesión por API en E2E.');
  }

  const apiContext = await playwrightRequest.newContext();
  try {
    const response = await apiContext.post(`${apiUrl}/auth/login`, {
      data: { email, password },
    });
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Fallo al iniciar sesión por API (${response.status()}): ${body}`);
    }

    const { cookies } = await apiContext.storageState();
    if (cookies.length > 0) {
      await page.context().addCookies(cookies);
    }
  } finally {
    await apiContext.dispose();
  }

  const hintExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await page.addInitScript((expiresAt: string) => {
    if (!window.sessionStorage.getItem('__e2e_hint_set')) {
      window.localStorage.setItem('sigoa.session-hint', expiresAt);
      window.sessionStorage.setItem('__e2e_hint_set', '1');
    }
  }, hintExpiresAt);

  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'FISME-SIGOA' })).toBeVisible();

  return { email, password };
}

export async function seedPendingUser(options: {
  email?: string;
  token?: string;
  expiresAt?: string | Date;
  used?: boolean;
}): Promise<{ email: string; token: string }> {
  const timestamp = Date.now();
  const email = options.email ?? `e2e-pending-${timestamp}@example.test`;
  const token = options.token ?? `e2e-token-${timestamp}-1234567890abcdef1234567890abcdef`;

  await seedUser({
    email,
    names: 'Usuario',
    firstSurname: 'Pendiente',
    status: 'PENDING_ACTIVATION',
    activationToken: {
      token,
      expiresAt: options.expiresAt,
      used: options.used,
    },
  });

  return { email, token };
}

export async function seedRecoveryUser(options: {
  email?: string;
  token?: string;
  password?: string;
  expiresAt?: string | Date;
  used?: boolean;
}): Promise<{ email: string; token: string; password: string }> {
  const timestamp = Date.now();
  const email = options.email ?? `e2e-recovery-${timestamp}@example.test`;
  const token = options.token ?? `e2e-recovery-token-${timestamp}-1234567890abcdef1234567890`;
  const password = options.password ?? 'OldPassword123!';

  await seedUser({
    email,
    password,
    names: 'Usuario',
    firstSurname: 'Recuperacion',
    status: 'ACTIVE',
    activationToken: {
      token,
      expiresAt: options.expiresAt,
      used: options.used,
    },
  });

  return { email, token, password };
}
