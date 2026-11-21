import { describe, expect, it, vi } from 'vitest';
import { drainInFlightForTests, shareInFlight } from './shared-in-flight';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('shareInFlight', () => {
  it('starts one operation for simultaneous callers with the same key and shares its result', async () => {
    const gate = deferred<string>();
    const start = vi.fn(() => gate.promise);

    const calls = [
      shareInFlight('same', start),
      shareInFlight('same', start),
      shareInFlight('same', start),
    ];
    gate.resolve('hecho');

    expect(start).toHaveBeenCalledTimes(1);
    expect(await Promise.all(calls)).toEqual(['hecho', 'hecho', 'hecho']);
  });

  it('keeps operations with different keys independent', async () => {
    const start = vi.fn(async () => 'ok');

    await Promise.all([shareInFlight('a', start), shareInFlight('b', start)]);

    expect(start).toHaveBeenCalledTimes(2);
  });

  it('releases the key after success so the operation can run again', async () => {
    const start = vi.fn(async () => 'ok');

    await shareInFlight('again', start);
    await shareInFlight('again', start);

    expect(start).toHaveBeenCalledTimes(2);
  });

  it('shares the failure with every caller and releases the key for a manual retry', async () => {
    const gate = deferred<string>();
    const failing = vi.fn(() => gate.promise);
    const first = shareInFlight('fails', failing);
    const second = shareInFlight('fails', failing);
    gate.reject(new Error('409'));

    await expect(first).rejects.toThrow('409');
    await expect(second).rejects.toThrow('409');
    expect(failing).toHaveBeenCalledTimes(1);

    const retry = vi.fn(async () => 'recuperado');
    await expect(shareInFlight('fails', retry)).resolves.toBe('recuperado');
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('reports and clears pending keys when drained for tests without letting late settlement delete a new entry', async () => {
    const firstGate = deferred<string>();
    const secondGate = deferred<string>();

    const first = shareInFlight('leaked', () => firstGate.promise);
    expect(drainInFlightForTests()).toEqual(['leaked']);
    expect(drainInFlightForTests()).toEqual([]);

    const second = shareInFlight('leaked', () => secondGate.promise);
    firstGate.resolve('primera');
    await expect(first).resolves.toBe('primera');

    // La resolución tardía de la primera promesa no debe haber eliminado la segunda de inFlight
    const joinedSecond = shareInFlight('leaked', () => Promise.resolve('otra'));
    secondGate.resolve('segunda');
    await expect(second).resolves.toBe('segunda');
    await expect(joinedSecond).resolves.toBe('segunda');
  });
});
