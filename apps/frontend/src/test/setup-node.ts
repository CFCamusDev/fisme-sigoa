import { afterEach, beforeAll, vi } from 'vitest';
import { drainInFlightForTests } from '@/lib/shared-in-flight';
import { server } from './msw/server';

const globalForMsw = globalThis as typeof globalThis & {
  __sigoaMswListening?: boolean;
};

beforeAll(() => {
  // Con isolate: false en Vitest, varios archivos comparten el mismo worker y la instancia de MSW.
  if (!globalForMsw.__sigoaMswListening) {
    server.listen();
    globalForMsw.__sigoaMswListening = true;
  }
});

afterEach(() => {
  vi.useRealTimers();
  server.resetHandlers();
  const leaked = drainInFlightForTests();
  if (leaked.length > 0) {
    throw new Error(
      `La prueba terminó dejando operaciones shareInFlight en vuelo: ${leaked.join(', ')}. ` +
        'Usa una promesa controlada (gate/release) y espera a que la mutación termine antes de salir del test.',
    );
  }
});
