import { describe, expect, it } from 'vitest';
import { createAuthorizationServices } from './index.js';

describe('Authorization Module Entrypoint', () => {
  it('instantiates authorization services factory', () => {
    const services = createAuthorizationServices({});
    expect(services).toBeDefined();
  });
});
