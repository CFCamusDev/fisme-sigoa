import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('env configuration', () => {
  it('parseEnv applies defaults for PORT and LOG_LEVEL', () => {
    const parsed = parseEnv({
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
    });

    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.PORT).toBe(3000);
    expect(parsed.LOG_LEVEL).toBe('info');
    expect(parsed.DATABASE_URL).toBe('postgresql://user:secret@localhost:5432/test_db');
  });

  it('parseEnv throws when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('parseEnv rejects an out-of-range PORT', () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        PORT: '70000',
      }),
    ).toThrow(/PORT/);

    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        PORT: '0',
      }),
    ).toThrow(/PORT/);
  });

  it('parseEnv error message lists variable names but not values', () => {
    const sensitiveValue = 'super-secret-password-12345';
    let errorMessage = '';

    try {
      parseEnv({
        PORT: 'not-a-number',
        NODE_ENV: sensitiveValue,
      });
    } catch (error) {
      errorMessage = (error as Error).message;
    }

    expect(errorMessage).toContain('DATABASE_URL');
    expect(errorMessage).toContain('PORT');
    expect(errorMessage).toContain('NODE_ENV');
    expect(errorMessage).not.toContain(sensitiveValue);
  });

  it('parseEnv splits CORS_ORIGIN into a list', () => {
    const parsed = parseEnv({
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
      CORS_ORIGIN: 'http://localhost:5173, https://sigoa.unterm.edu.pe',
    });

    expect(parsed.CORS_ORIGIN).toEqual(['http://localhost:5173', 'https://sigoa.unterm.edu.pe']);
  });

  it('parseEnv defaults HSTS_ENABLED to true', () => {
    const parsed = parseEnv({
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
    });

    expect(parsed.HSTS_ENABLED).toBe(true);

    const disabled = parseEnv({
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
      HSTS_ENABLED: 'false',
    });
    expect(disabled.HSTS_ENABLED).toBe(false);
  });

  it('parseEnv rejects a wildcard CORS_ORIGIN', () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        CORS_ORIGIN: '*',
      }),
    ).toThrow(/CORS_ORIGIN/);

    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        CORS_ORIGIN: 'http://localhost:5173, *',
      }),
    ).toThrow(/CORS_ORIGIN/);
  });

  it('parseEnv rejects TRUST_PROXY true and negative values', () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        TRUST_PROXY: 'true',
      }),
    ).toThrow(/TRUST_PROXY/);

    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        TRUST_PROXY: '-1',
      }),
    ).toThrow(/TRUST_PROXY/);
  });

  it('parseEnv applies rate limit defaults', () => {
    const parsed = parseEnv({
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
    });

    expect(parsed.TRUST_PROXY).toBe(0);
    expect(parsed.RATE_LIMIT_WINDOW_MS).toBe(60000);
    expect(parsed.RATE_LIMIT_PUBLIC_MAX).toBe(30);
    expect(parsed.RATE_LIMIT_LOGIN_MAX).toBe(10);
    expect(parsed.RATE_LIMIT_SESSION_MAX).toBe(30);
    expect(parsed.RATE_LIMIT_GENERAL_MAX).toBe(300);
    expect(parsed.AUTH_COOKIE_SAMESITE).toBe('strict');
  });

  it('validates AUTH_COOKIE_SAMESITE configurations', () => {
    // Valor por defecto en development: strict
    const defaultDev = parseEnv({
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
    });
    expect(defaultDev.AUTH_COOKIE_SAMESITE).toBe('strict');

    // Valor explícito válido: lax
    const laxParsed = parseEnv({
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
      AUTH_COOKIE_SAMESITE: 'lax',
    });
    expect(laxParsed.AUTH_COOKIE_SAMESITE).toBe('lax');

    // Rechaza valor desconocido
    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        AUTH_COOKIE_SAMESITE: 'invalid-samesite',
      }),
    ).toThrow(/AUTH_COOKIE_SAMESITE/);

    // Rechaza none fuera de production
    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        NODE_ENV: 'development',
        AUTH_COOKIE_SAMESITE: 'none',
      }),
    ).toThrow(/AUTH_COOKIE_SAMESITE/);

    // Permite none en production (cuando hay HTTPS)
    const noneProd = parseEnv({
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
      NODE_ENV: 'production',
      AUTH_COOKIE_SAMESITE: 'none',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_valid_key_123',
      EMAIL_FROM: 'sigoa@untrim.edu.pe',
      FILE_STORAGE_PROVIDER: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: 'cloud',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
      APP_PUBLIC_URL: 'https://sigoa.untrim.edu.pe',
      AUTH_JWT_SECRET: 'super-secret-production-key-at-least-32-chars-long',
    });
    expect(noneProd.AUTH_COOKIE_SAMESITE).toBe('none');
  });

  it('parseEnv defaults EMAIL_PROVIDER to memory and treats empty strings as undefined', () => {
    const parsed = parseEnv({
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
      RESEND_API_KEY: '',
      EMAIL_FROM: '   ',
    });

    expect(parsed.EMAIL_PROVIDER).toBe('memory');
    expect(parsed.RESEND_API_KEY).toBeUndefined();
    expect(parsed.EMAIL_FROM).toBeUndefined();
  });

  it('parseEnv requires RESEND_API_KEY and valid EMAIL_FROM when EMAIL_PROVIDER is resend', () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        EMAIL_PROVIDER: 'resend',
      }),
    ).toThrow(/RESEND_API_KEY/);

    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_123456789',
        EMAIL_FROM: 'not-an-email',
      }),
    ).toThrow(/EMAIL_FROM/);

    const valid = parseEnv({
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_123456789',
      EMAIL_FROM: 'sigoa@untrim.edu.pe',
    });
    expect(valid.EMAIL_PROVIDER).toBe('resend');
    expect(valid.RESEND_API_KEY).toBe('re_123456789');
    expect(valid.EMAIL_FROM).toBe('sigoa@untrim.edu.pe');
  });

  it('parseEnv rejects memory EMAIL_PROVIDER in production', () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        NODE_ENV: 'production',
        EMAIL_PROVIDER: 'memory',
      }),
    ).toThrow(/EMAIL_PROVIDER/);
  });

  it('parseEnv defaults FILE_STORAGE_PROVIDER to memory and treats empty strings as undefined', () => {
    const parsed = parseEnv({
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
      CLOUDINARY_CLOUD_NAME: '   ',
      CLOUDINARY_API_KEY: '',
      CLOUDINARY_API_SECRET: '',
    });

    expect(parsed.FILE_STORAGE_PROVIDER).toBe('memory');
    expect(parsed.CLOUDINARY_CLOUD_NAME).toBeUndefined();
    expect(parsed.CLOUDINARY_API_KEY).toBeUndefined();
    expect(parsed.CLOUDINARY_API_SECRET).toBeUndefined();
  });

  it('parseEnv requires all three Cloudinary variables when FILE_STORAGE_PROVIDER is cloudinary', () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        FILE_STORAGE_PROVIDER: 'cloudinary',
      }),
    ).toThrow(/CLOUDINARY_CLOUD_NAME/);

    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        FILE_STORAGE_PROVIDER: 'cloudinary',
        CLOUDINARY_CLOUD_NAME: 'cloud',
      }),
    ).toThrow(/CLOUDINARY_API_KEY/);

    const valid = parseEnv({
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
      FILE_STORAGE_PROVIDER: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: 'cloud',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
    });

    expect(valid.FILE_STORAGE_PROVIDER).toBe('cloudinary');
    expect(valid.CLOUDINARY_CLOUD_NAME).toBe('cloud');
    expect(valid.CLOUDINARY_API_KEY).toBe('key');
    expect(valid.CLOUDINARY_API_SECRET).toBe('secret');
  });

  it('parseEnv rejects memory FILE_STORAGE_PROVIDER in production', () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        NODE_ENV: 'production',
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_123',
        EMAIL_FROM: 'sigoa@untrim.edu.pe',
        FILE_STORAGE_PROVIDER: 'memory',
      }),
    ).toThrow(/FILE_STORAGE_PROVIDER/);
  });

  describe('APP_PUBLIC_URL configuration (T-077-05)', () => {
    it('defaults to http://localhost:5173 when missing or empty in development', () => {
      const parsed = parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
      });
      expect(parsed.APP_PUBLIC_URL).toBe('http://localhost:5173');

      const parsedEmpty = parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        APP_PUBLIC_URL: '   ',
      });
      expect(parsedEmpty.APP_PUBLIC_URL).toBe('http://localhost:5173');
    });

    it('removes trailing slashes from APP_PUBLIC_URL', () => {
      const parsed = parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        APP_PUBLIC_URL: 'http://localhost:8001///',
      });
      expect(parsed.APP_PUBLIC_URL).toBe('http://localhost:8001');
    });

    it('rejects invalid URLs for APP_PUBLIC_URL', () => {
      expect(() =>
        parseEnv({
          DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
          APP_PUBLIC_URL: 'invalid-url',
        }),
      ).toThrow(/APP_PUBLIC_URL/);
    });

    it('requires APP_PUBLIC_URL in production environment', () => {
      expect(() =>
        parseEnv({
          DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
          NODE_ENV: 'production',
          EMAIL_PROVIDER: 'resend',
          RESEND_API_KEY: 're_123',
          EMAIL_FROM: 'sigoa@untrim.edu.pe',
          FILE_STORAGE_PROVIDER: 'cloudinary',
          CLOUDINARY_CLOUD_NAME: 'cloud',
          CLOUDINARY_API_KEY: 'key',
          CLOUDINARY_API_SECRET: 'secret',
        }),
      ).toThrow(/APP_PUBLIC_URL/);
    });

    it('rejects http:// URLs for APP_PUBLIC_URL in production', () => {
      expect(() =>
        parseEnv({
          DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
          NODE_ENV: 'production',
          EMAIL_PROVIDER: 'resend',
          RESEND_API_KEY: 're_123',
          EMAIL_FROM: 'sigoa@untrim.edu.pe',
          FILE_STORAGE_PROVIDER: 'cloudinary',
          CLOUDINARY_CLOUD_NAME: 'cloud',
          CLOUDINARY_API_KEY: 'key',
          CLOUDINARY_API_SECRET: 'secret',
          APP_PUBLIC_URL: 'http://sigoa.unterm.edu.pe',
        }),
      ).toThrow(/APP_PUBLIC_URL/);
    });

    it('accepts valid https:// APP_PUBLIC_URL in production', () => {
      const valid = parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        NODE_ENV: 'production',
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_123',
        EMAIL_FROM: 'sigoa@untrim.edu.pe',
        FILE_STORAGE_PROVIDER: 'cloudinary',
        CLOUDINARY_CLOUD_NAME: 'cloud',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
        AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-production-key',
        APP_PUBLIC_URL: 'https://sigoa.unterm.edu.pe/',
      });
      expect(valid.APP_PUBLIC_URL).toBe('https://sigoa.unterm.edu.pe');
    });
  });

  describe('auth env settings (HU-001, T-001-10)', () => {
    const validProdBase = {
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
      NODE_ENV: 'production',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_123',
      EMAIL_FROM: 'sigoa@untrim.edu.pe',
      FILE_STORAGE_PROVIDER: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: 'cloud',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
      APP_PUBLIC_URL: 'https://sigoa.unterm.edu.pe',
    };

    it('requires a 32 character jwt secret in production', () => {
      expect(() =>
        parseEnv({
          ...validProdBase,
          AUTH_JWT_SECRET: 'too-short-secret',
        }),
      ).toThrow(/AUTH_JWT_SECRET/);

      expect(() =>
        parseEnv({
          ...validProdBase,
        }),
      ).toThrow(/AUTH_JWT_SECRET/);
    });

    it('rejects a weak or placeholder jwt secret in production', () => {
      expect(() =>
        parseEnv({
          ...validProdBase,
          AUTH_JWT_SECRET: '12345678901234567890123456789012',
        }),
      ).toThrow(/AUTH_JWT_SECRET/);
    });

    it('generates a random jwt secret outside production if omitted', () => {
      const parsed = parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
      });

      expect(parsed.AUTH_JWT_SECRET).toBeDefined();
      expect(parsed.AUTH_JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    });

    it('reads lockout and ttl settings with defaults', () => {
      const parsed = parseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test_db',
        AUTH_ACCESS_TTL_SECONDS: '1800',
        AUTH_REFRESH_TTL_DAYS: '14',
        AUTH_MAX_FAILED_ATTEMPTS: '3',
        AUTH_LOCKOUT_MINUTES: '30',
      });

      expect(parsed.AUTH_ACCESS_TTL_SECONDS).toBe(1800);
      expect(parsed.AUTH_REFRESH_TTL_DAYS).toBe(14);
      expect(parsed.AUTH_MAX_FAILED_ATTEMPTS).toBe(3);
      expect(parsed.AUTH_LOCKOUT_MINUTES).toBe(30);
    });
  });
});
