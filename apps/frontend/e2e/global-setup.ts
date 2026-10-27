import { execSync } from 'node:child_process';

export default async function globalSetup(): Promise<void> {
  execSync('pnpm --filter backend db:test:prepare', {
    stdio: 'inherit',
    env: { ...process.env },
  });
}
