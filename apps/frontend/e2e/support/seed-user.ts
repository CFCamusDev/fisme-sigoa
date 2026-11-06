import { execSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';

export interface ActivationTokenSeedOptions {
  token: string;
  expiresAt?: string | Date;
  used?: boolean;
}

export interface SeedUserOptions {
  email: string;
  password?: string;
  names?: string;
  firstSurname?: string;
  secondSurname?: string | null;
  dni?: string | null;
  roles?: string[];
  status?: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION';
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  activationToken?: ActivationTokenSeedOptions;
}

export function seedUser(options: SeedUserOptions): void {
  const testDbUrl =
    process.env['TEST_DATABASE_URL'] ||
    process.env['DATABASE_URL'] ||
    'postgresql://postgres:postgres@localhost:5432/sigoa_test?schema=public';

  execSync('pnpm --filter backend run seed:e2e-user', {
    stdio: 'pipe',
    env: {
      ...process.env,
      TEST_DATABASE_URL: testDbUrl,
      DATABASE_URL: testDbUrl,
      SEED_USER_DATA: JSON.stringify(options),
    },
  });
}

export async function loginAsTestUser(
  page: Page,
  overrides?: Partial<SeedUserOptions>,
): Promise<{ email: string; password: string }> {
  const email = overrides?.email ?? `e2e-auth-${Date.now()}@example.test`;
  const password = overrides?.password ?? 'Password123!';

  seedUser({
    email,
    password,
    names: 'Usuario',
    firstSurname: 'Prueba',
    status: 'ACTIVE',
    ...overrides,
  });

  await page.goto('/login');
  await page.getByLabel(/correo electrónico/i).fill(email);
  await page.getByLabel(/contraseña/i).fill(password);
  await page.getByRole('button', { name: /acceder al sistema/i }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'FISME-SIGOA' })).toBeVisible();

  return { email, password };
}

export function seedPendingUser(options: {
  email?: string;
  token?: string;
  expiresAt?: string | Date;
  used?: boolean;
}): { email: string; token: string } {
  const timestamp = Date.now();
  const email = options.email ?? `e2e-pending-${timestamp}@example.test`;
  const token = options.token ?? `e2e-token-${timestamp}-1234567890abcdef1234567890abcdef`;

  seedUser({
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
