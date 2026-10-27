import { describe, expect, it } from 'vitest';
import {
  getRequestContext,
  requestContextProvider,
  runWithRequestContext,
  setRequestActor,
} from './request-context.js';

describe('RequestContext with AsyncLocalStorage (RS-041)', () => {
  it('returns undefined when accessed outside of a request scope', () => {
    expect(getRequestContext()).toBeUndefined();
    expect(requestContextProvider.get()).toBeUndefined();
  });

  it('provides the current context inside runWithRequestContext', async () => {
    const context = {
      actor: 'user-123',
      ip: '10.0.0.1',
      requestId: 'req-abc-1',
    };

    await runWithRequestContext(context, async () => {
      expect(getRequestContext()).toEqual(context);
      expect(requestContextProvider.get()).toEqual(context);
    });

    expect(getRequestContext()).toBeUndefined();
  });

  it('isolates concurrent asynchronous contexts accurately', async () => {
    const taskA = runWithRequestContext(
      { actor: 'user-a', ip: '1.1.1.1', requestId: 'req-a' },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return getRequestContext();
      },
    );

    const taskB = runWithRequestContext(
      { actor: 'user-b', ip: '2.2.2.2', requestId: 'req-b' },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return getRequestContext();
      },
    );

    const [resA, resB] = await Promise.all([taskA, taskB]);

    expect(resA?.actor).toBe('user-a');
    expect(resA?.requestId).toBe('req-a');

    expect(resB?.actor).toBe('user-b');
    expect(resB?.requestId).toBe('req-b');
  });

  it('updates actor with setRequestActor within the current request only', async () => {
    await runWithRequestContext({ requestId: 'req-anon', ip: '192.168.1.1' }, async () => {
      expect(getRequestContext()?.actor).toBeUndefined();

      setRequestActor('user-authenticated-456');

      expect(getRequestContext()?.actor).toBe('user-authenticated-456');
    });

    expect(getRequestContext()).toBeUndefined();
  });
});
