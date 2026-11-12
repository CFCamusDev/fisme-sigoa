import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './msw/server';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  if (typeof window !== 'undefined') {
    window.scrollTo = vi.fn();
  }
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
