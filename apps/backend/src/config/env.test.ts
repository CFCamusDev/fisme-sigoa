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
});
