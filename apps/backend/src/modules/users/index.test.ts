import { describe, it, expect } from 'vitest';
import { createUsersModule } from './index.js';

describe('users module', () => {
  it('creates an express router', () => {
    const router = createUsersModule();
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
    expect(typeof router.use).toBe('function');
  });
});
