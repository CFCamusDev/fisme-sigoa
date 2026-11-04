import { execSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';

export interface SeedUserOptions {
  email: string;
  password?: string;
  names?: string;
  firstSurname?: string;
  secondSurname?: string | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION';
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
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
