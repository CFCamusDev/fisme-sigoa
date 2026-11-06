import path from 'node:path';
import { describe, it, expect } from 'vitest';
// @ts-expect-error script sin archivo de declaraciones .d.ts
import { resolveBashPath } from '../../../../scripts/ci/resolve-bash-path.mjs';

describe('resolveBashPath (T-004-19, RNF-030)', () => {
  it('returns bash on Linux and macOS', () => {
    expect(resolveBashPath({ platform: 'linux' })).toBe('bash');
    expect(resolveBashPath({ platform: 'darwin' })).toBe('bash');
  });

  it('honours GIT_BASH', () => {
    const customBash = 'D:\\Tools\\Git\\bin\\bash.exe';
    const result = resolveBashPath({
      platform: 'win32',
      env: { GIT_BASH: customBash },
      existsSync: (p: string) => p === customBash,
    });
    expect(result).toBe(customBash);
  });

  it('fails when GIT_BASH points to a missing file', () => {
    const missingBash = 'C:\\Missing\\bash.exe';
    expect(() =>
      resolveBashPath({
        platform: 'win32',
        env: { GIT_BASH: missingBash },
        existsSync: () => false,
      }),
    ).toThrow(/GIT_BASH/);
  });

  it('picks Git Bash from the Git root', () => {
    const gitExe = 'C:\\Program Files\\Git\\cmd\\git.exe';
    const expectedBash = path.win32.normalize('C:\\Program Files\\Git\\bin\\bash.exe');

    const result = resolveBashPath({
      platform: 'win32',
      locateGit: () => gitExe,
      existsSync: (p: string) => path.win32.normalize(p) === expectedBash,
    });

    expect(result).toBe(expectedBash);
  });

  it('picks Git Bash from usr/bin if bin/bash does not exist', () => {
    const gitExe = 'C:\\PortableGit\\cmd\\git.exe';
    const usrBash = path.win32.normalize('C:\\PortableGit\\usr\\bin\\bash.exe');

    const result = resolveBashPath({
      platform: 'win32',
      locateGit: () => gitExe,
      existsSync: (p: string) => path.win32.normalize(p) === usrBash,
    });

    expect(result).toBe(usrBash);
  });

  it('fails with an actionable message when only the WSL bash exists', () => {
    const wslBash = path.win32.normalize('C:\\Windows\\System32\\bash.exe');

    expect(() =>
      resolveBashPath({
        platform: 'win32',
        locateGit: () => null,
        existsSync: (p: string) => path.win32.normalize(p) === wslBash,
      }),
    ).toThrow(/Git for Windows.*GIT_BASH/i);
  });
});
