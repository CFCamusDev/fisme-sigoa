import { beforeEach, describe, expect, it } from 'vitest';
import { EmailDeliveryError } from './email-delivery-error.js';
import type { EmailMessage } from './email-sender.js';
import { InMemoryEmailSender } from './in-memory-email-sender.js';

describe('InMemoryEmailSender', () => {
  let sender: InMemoryEmailSender;

  beforeEach(() => {
    sender = new InMemoryEmailSender();
  });

  it('starts with an empty sent list', () => {
    expect(sender.sent).toEqual([]);
  });

  it('records sent messages and returns deterministic sequential message IDs', async () => {
    const msg1: EmailMessage = {
      to: 'docente@untrim.edu.pe',
      subject: 'Invitación a sesión de validación',
      template: 'invitation-template',
      variables: { recipientName: 'Dr. Torres', surveyUrl: 'https://example.com/s/1' },
    };
    const msg2: EmailMessage = {
      to: 'graduado@untrim.edu.pe',
      subject: 'Encuesta de empleabilidad',
      template: 'survey-template',
      variables: { year: 2026, active: true },
    };

    const res1 = await sender.send(msg1);
    const res2 = await sender.send(msg2);

    expect(res1).toEqual({ messageId: 'email-1' });
    expect(res2).toEqual({ messageId: 'email-2' });
    expect(sender.sent).toHaveLength(2);
    expect(sender.sent[0]).toEqual(msg1);
    expect(sender.sent[1]).toEqual(msg2);
  });

  it('returns defensive copies of messages so external mutation does not affect history', async () => {
    const variables = { recipientName: 'Original' };
    const msg: EmailMessage = {
      to: 'user@example.com',
      subject: 'Test',
      template: 'test',
      variables,
    };

    await sender.send(msg);

    // Mutate the original variables object
    variables.recipientName = 'Mutated';
    const first = sender.sent[0];
    expect(first).toBeDefined();
    expect(first?.variables['recipientName']).toBe('Original');

    // Mutate through getter if someone tries
    const snapshot = sender.sent;
    const firstSnapshot = snapshot[0];
    expect(firstSnapshot).toBeDefined();
    if (firstSnapshot) {
      (firstSnapshot.variables as Record<string, string>)['recipientName'] = 'MutatedAgain';
    }
    expect(sender.sent[0]?.variables['recipientName']).toBe('Original');
  });

  it('throws simulated error when simulateFailure is set', async () => {
    const error = new EmailDeliveryError('Fallo simulado en el proveedor');
    sender.simulateFailure = error;

    const msg: EmailMessage = {
      to: 'fail@example.com',
      subject: 'Fail',
      template: 'fail',
      variables: {},
    };

    await expect(sender.send(msg)).rejects.toThrow(error);
    expect(sender.sent).toHaveLength(0);
  });

  it('resets sent messages, counter and simulated failure on clear()', async () => {
    sender.simulateFailure = new Error('simulated');
    await expect(
      sender.send({
        to: 'test@example.com',
        subject: 'Sub',
        template: 'tpl',
        variables: {},
      }),
    ).rejects.toThrow();

    sender.clear();

    expect(sender.simulateFailure).toBeNull();
    expect(sender.sent).toEqual([]);

    const res = await sender.send({
      to: 'fresh@example.com',
      subject: 'Fresh',
      template: 'fresh',
      variables: {},
    });

    expect(res).toEqual({ messageId: 'email-1' });
    expect(sender.sent).toHaveLength(1);
  });
});
