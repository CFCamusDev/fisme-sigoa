import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { drainInFlightForTests } from '@/lib/shared-in-flight';
import { server } from './msw/server';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  if (typeof window !== 'undefined') {
    window.scrollTo = vi.fn();
  }
});

afterEach(() => {
  cleanup();
  if (typeof window !== 'undefined' && typeof window.localStorage?.clear === 'function') {
    window.localStorage.clear();
  }
  server.resetHandlers();
  const leaked = drainInFlightForTests();
  if (leaked.length > 0) {
    throw new Error(
      `La prueba terminó dejando operaciones shareInFlight en vuelo: ${leaked.join(', ')}. ` +
        'Usa una promesa controlada (gate/release) y espera a que la mutación termine antes de salir del test.',
    );
  }
});

afterAll(() => {
  server.close();
});
