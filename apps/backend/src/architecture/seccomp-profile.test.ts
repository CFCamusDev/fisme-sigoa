import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
// @ts-expect-error script CLI en ESM sin .d.ts local
import {
  buildChromiumProfile,
  DOCKER_DEFAULT_SHA256,
} from '../../../../scripts/ci/build-seccomp-profile.mjs';

interface SeccompRule {
  names?: string[];
  action: string;
  args?: unknown[];
  comment?: string;
  errnoRet?: number;
  includes?: {
    caps?: string[];
    arches?: string[];
  };
  excludes?: {
    caps?: string[];
    arches?: string[];
  };
}

interface SeccompProfile {
  defaultAction: string;
  defaultErrnoRet?: number;
  archMap?: unknown[];
  syscalls: SeccompRule[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../../');
const dockerDefaultPath = path.resolve(rootDir, 'deploy/seccomp/docker-default.json');
const chromiumProfilePath = path.resolve(rootDir, 'deploy/seccomp/chromium.json');

describe('Chromium Seccomp Profile (T-077-13, CA5)', () => {
  it('vendored docker default matches its pinned checksum', () => {
    expect(fs.existsSync(dockerDefaultPath)).toBe(true);
    const content = fs.readFileSync(dockerDefaultPath, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    expect(hash).toBe(DOCKER_DEFAULT_SHA256);
  });

  it('matches the profile generated from the vendored docker default', () => {
    const dockerDefault = JSON.parse(fs.readFileSync(dockerDefaultPath, 'utf8')) as SeccompProfile;
    const expected = buildChromiumProfile(dockerDefault);
    const actual = JSON.parse(fs.readFileSync(chromiumProfilePath, 'utf8'));

    expect(actual).toEqual(expected);
  });

  it('keeps every syscall rule of the docker default', () => {
    const dockerDefault = JSON.parse(fs.readFileSync(dockerDefaultPath, 'utf8')) as SeccompProfile;
    const chromium = JSON.parse(fs.readFileSync(chromiumProfilePath, 'utf8')) as SeccompProfile;

    expect(chromium.defaultAction).toBe('SCMP_ACT_ERRNO');
    expect(chromium.archMap).toEqual(dockerDefault.archMap);

    // Todas las reglas de Docker default deben estar presentes
    for (const dockerRule of dockerDefault.syscalls) {
      const match = chromium.syscalls.find(
        (r) =>
          r.action === dockerRule.action &&
          JSON.stringify(r.names?.slice().sort()) ===
            JSON.stringify(dockerRule.names?.slice().sort()) &&
          JSON.stringify(r.args) === JSON.stringify(dockerRule.args) &&
          JSON.stringify(r.includes) === JSON.stringify(dockerRule.includes) &&
          JSON.stringify(r.excludes) === JSON.stringify(dockerRule.excludes),
      );
      expect(
        match,
        `Falta la regla de docker default: ${JSON.stringify(dockerRule.names)}`,
      ).toBeDefined();
    }
  });

  it('allows arch_prctl on amd64 and allows futex_wake and fork', () => {
    const chromium = JSON.parse(fs.readFileSync(chromiumProfilePath, 'utf8')) as SeccompProfile;

    const archPrctlRule = chromium.syscalls.find(
      (r) =>
        r.names?.includes('arch_prctl') &&
        r.action === 'SCMP_ACT_ALLOW' &&
        (r.includes?.arches?.includes('x86_64') ||
          r.includes?.arches?.includes('amd64') ||
          r.includes?.arches?.includes('x32')),
    );
    expect(archPrctlRule).toBeDefined();

    const futexRule = chromium.syscalls.find(
      (r) => r.names?.includes('futex') && r.action === 'SCMP_ACT_ALLOW',
    );
    expect(futexRule).toBeDefined();

    const forkRule = chromium.syscalls.find(
      (r) => r.names?.includes('fork') && r.action === 'SCMP_ACT_ALLOW',
    );
    expect(forkRule).toBeDefined();
  });

  it('opens only clone, unshare and setns for user namespaces and keeps clone3 blocked as in docker default', () => {
    const dockerDefault = JSON.parse(fs.readFileSync(dockerDefaultPath, 'utf8')) as SeccompProfile;
    const chromium = JSON.parse(fs.readFileSync(chromiumProfilePath, 'utf8')) as SeccompProfile;

    // Debe existir exactamente una regla agregada
    expect(chromium.syscalls.length).toBe(dockerDefault.syscalls.length + 1);

    const addedRule = chromium.syscalls.find(
      (r) =>
        r.action === 'SCMP_ACT_ALLOW' &&
        !r.includes &&
        !r.excludes &&
        !r.args &&
        r.names?.includes('clone') &&
        r.names?.includes('unshare') &&
        r.names?.includes('setns'),
    );
    expect(addedRule).toBeDefined();
    expect(addedRule?.names?.slice().sort()).toEqual(['clone', 'setns', 'unshare']);

    // clone3 debe mantenerse bloqueada (SCMP_ACT_ERRNO 38) cuando no hay CAP_SYS_ADMIN
    const clone3Blocked = chromium.syscalls.find(
      (r) =>
        r.names?.includes('clone3') &&
        r.action === 'SCMP_ACT_ERRNO' &&
        r.errnoRet === 38 &&
        r.excludes?.caps?.includes('CAP_SYS_ADMIN'),
    );
    expect(clone3Blocked).toBeDefined();
  });

  it('never allows dangerous syscalls unconditionally', () => {
    const chromium = JSON.parse(fs.readFileSync(chromiumProfilePath, 'utf8')) as SeccompProfile;

    const dangerousSyscalls = [
      'mount',
      'umount2',
      'reboot',
      'kexec_load',
      'init_module',
      'finit_module',
      'delete_module',
      'bpf',
      'swapon',
      'pivot_root',
      'open_by_handle_at',
      'io_uring_setup',
      'io_uring_enter',
      'io_uring_register',
    ];

    for (const rule of chromium.syscalls) {
      if (rule.action === 'SCMP_ACT_ALLOW' && !rule.includes?.caps) {
        for (const dangerous of dangerousSyscalls) {
          expect(
            rule.names?.includes(dangerous),
            `Llamada peligrosa ${dangerous} permitida sin condición de capacidad`,
          ).toBe(false);
        }
      }
    }

    expect(chromium.defaultAction).toBe('SCMP_ACT_ERRNO');
  });
});
