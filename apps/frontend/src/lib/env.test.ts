import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('parses valid environment variables with valid URL', () => {
    const validSource = {
      VITE_API_URL: 'http://localhost:3000',
    };

    const parsed = parseEnv(validSource);
    expect(parsed.VITE_API_URL).toBe('http://localhost:3000');
  });

  it('throws a descriptive error in Spanish when VITE_API_URL is missing', () => {
    expect(() => parseEnv({})).toThrowError(/Error en las variables de entorno.*VITE_API_URL/);
  });

  it('throws a descriptive error in Spanish when VITE_API_URL is not a valid URL', () => {
    expect(() => parseEnv({ VITE_API_URL: 'invalid-url' })).toThrowError(/debe ser una URL válida/);
  });
});
