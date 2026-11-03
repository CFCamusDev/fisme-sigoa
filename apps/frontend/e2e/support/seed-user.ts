import { execSync } from 'node:child_process';

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
