import { afterAll, afterEach, beforeAll } from 'vitest';
import { drainInFlightForTests } from '@/lib/shared-in-flight';
import { server } from './msw/server';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
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
