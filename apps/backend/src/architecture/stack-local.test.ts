import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  ACTIONS,
  assertEnvFile,
  buildComposeArgs,
  COMPOSE_FILE,
  ENV_FILE,
  main,
  parseServerPort,
  PROJECT_NAME,
  waitForHealth,
  // @ts-expect-error script sin archivo de declaraciones .d.ts
} from '../../../../scripts/deploy/stack-local.mjs';

describe('stack-local (HU-079, CA6)', () => {
  it('builds compose arguments for the local staging project', () => {
    const up: string[] = buildComposeArgs('up');
    expect(PROJECT_NAME).toBe('sigoa-staging-local');
    expect(ENV_FILE).toBe('.env.staging.local');
    expect(COMPOSE_FILE).toBe('docker-compose.prod.yml');
    expect(up).toEqual([
      'compose',
      '-p',
      'sigoa-staging-local',
      '--env-file',
      '.env.staging.local',
      '-f',
      'docker-compose.prod.yml',
      'up',
      '-d',
      '--build',
    ]);
  });

  it('removes volumes and orphans on down', () => {
    const down: string[] = buildComposeArgs('down');
    expect(down).toContain('-v');
    expect(down).toContain('--remove-orphans');
    expect(down.slice(0, 7)).toEqual(buildComposeArgs('up').slice(0, 7));
    expect(down).not.toContain('--build');
  });

  it('rejects an unknown compose action', () => {
    expect(() => buildComposeArgs('restart')).toThrow(/desconocida/);
  });

  it('fails with a clear message when .env.staging.local is missing', () => {
    expect(() => assertEnvFile(ENV_FILE, () => false)).toThrow(
      /\.env\.staging\.local.*stack\.env\.example/s,
    );
    expect(() => assertEnvFile(ENV_FILE, () => true)).not.toThrow();
  });

  it('rejects an invalid action before touching docker', async () => {
    await expect(main(['restart'])).rejects.toThrow(/Uso:/);
    await expect(main([])).rejects.toThrow(/Uso:/);
    expect(ACTIONS).toEqual(['up', 'down', 'reset']);
  });

  it('reads SERVER_PORT from the env file and defaults to 3000', () => {
    expect(parseServerPort('DB_NAME=x\nSERVER_PORT=3400\n')).toBe(3400);
    expect(parseServerPort('DB_NAME=x\n')).toBe(3000);
    expect(parseServerPort('SERVER_PORT=abc\n')).toBe(3000);
  });

  it('waits for /health with a bounded number of attempts', async () => {
    let clock = 0;
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    await waitForHealth('http://localhost:3000/health', {
      timeoutMs: 10_000,
      fetchFn,
      sleep: async (ms: number) => {
        clock += ms;
      },
      now: () => clock,
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('gives up when /health never answers within the limit', async () => {
    let clock = 0;
    const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      waitForHealth('http://localhost:3000/health', {
        timeoutMs: 5_000,
        fetchFn,
        sleep: async (ms: number) => {
          clock += ms;
        },
        now: () => clock,
      }),
    ).rejects.toThrow(/no respondió/);
    expect(fetchFn).toHaveBeenCalledTimes(6);
  });

  it('exposes the stack:local commands in the root package.json and ignores the env file', () => {
    const root = resolve(__dirname, '../../../..');
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts['stack:local:up']).toBe('node scripts/deploy/stack-local.mjs up');
    expect(packageJson.scripts['stack:local:down']).toBe(
      'node scripts/deploy/stack-local.mjs down',
    );
    expect(packageJson.scripts['stack:local:reset']).toBe(
      'node scripts/deploy/stack-local.mjs reset',
    );
    expect(readFileSync(resolve(root, '.gitignore'), 'utf8')).toMatch(/^\.env\.\*$/m);
  });
});
