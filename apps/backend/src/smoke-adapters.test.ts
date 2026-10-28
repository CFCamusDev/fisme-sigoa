import { describe, it, expect, vi } from 'vitest';
import { parseArgs, runSmokeAdapters } from './smoke-adapters.js';

describe('smoke-adapters script (T-076-05, T-076-02)', () => {
  it('correctly parses CLI arguments', () => {
    const opts = parseArgs(['--email', 'test@unexample.edu.pe', '--storage']);
    expect(opts.email).toBe('test@unexample.edu.pe');
    expect(opts.storage).toBe(true);
  });

  it('runs without action when no arguments provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(runSmokeAdapters({})).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Uso: pnpm smoke:adapters'));
    consoleSpy.mockRestore();
  });

  it('executes storage smoke test with in-memory provider successfully', async () => {
    await expect(runSmokeAdapters({ storage: true })).resolves.toBeUndefined();
  });

  it('executes email smoke test with in-memory provider successfully', async () => {
    await expect(runSmokeAdapters({ email: 'docente@unexample.edu.pe' })).resolves.toBeUndefined();
  });
});
