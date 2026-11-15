import { expect, type Page } from '@playwright/test';
import { getWorkerSeeder, type ActivationTokenSeedOptions, type SeedUserOptions } from './seeder';

export type { ActivationTokenSeedOptions, SeedUserOptions };

export async function seedUser(options: SeedUserOptions): Promise<{ id: string; email: string }> {
  return getWorkerSeeder().seedUser(options);
}

export async function loginAsTestUser(
  page: Page,
  overrides?: Partial<SeedUserOptions>,
): Promise<{ email: string; password: string }> {
  const email = overrides?.email ?? `e2e-auth-${Date.now()}@example.test`;
  const password = overrides?.password ?? 'Password123!';

  await seedUser({
    email,
    password,
    names: 'Usuario',
    firstSurname: 'Prueba',
    roles: ['ADMINISTRATOR'],
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
