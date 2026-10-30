import { describe, expect, it } from 'vitest';
import { verifyHardening } from '../../../../scripts/ci/verify-compose-hardening.mjs';

describe('verify-compose-hardening logic', () => {
  const validBackendConfig = {
    services: {
      backend: {
        cap_drop: ['ALL'],
        security_opt: ['no-new-privileges:true', 'seccomp=./deploy/seccomp/chromium.json'],
        read_only: true,
        tmpfs: ['/tmp:size=256M'],
        environment: {
          PDF_CHROMIUM_NO_SANDBOX: 'false',
        },
      },
    },
  };

  it('passes on valid hardened configuration', () => {
    const errors = verifyHardening(validBackendConfig);
    expect(errors).toEqual([]);
  });

  it('fails if cap_drop ALL is missing', () => {
    const config = {
      services: {
        backend: {
          ...validBackendConfig.services.backend,
          cap_drop: [],
        },
      },
    };
    const errors = verifyHardening(config);
    expect(errors.some((e) => e.includes('cap_drop'))).toBe(true);
  });

  it('fails if PDF_CHROMIUM_NO_SANDBOX is true', () => {
    const config = {
      services: {
        backend: {
          ...validBackendConfig.services.backend,
          environment: { PDF_CHROMIUM_NO_SANDBOX: 'true' },
        },
      },
    };
    const errors = verifyHardening(config);
    expect(errors.some((e) => e.includes('PDF_CHROMIUM_NO_SANDBOX'))).toBe(true);
  });

  it('fails if read_only is false', () => {
    const config = {
      services: {
        backend: {
          ...validBackendConfig.services.backend,
          read_only: false,
        },
      },
    };
    const errors = verifyHardening(config);
    expect(errors.some((e) => e.includes('read_only'))).toBe(true);
  });
});
