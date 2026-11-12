import { describe, it, expect, vi } from 'vitest';
import type { Logger } from 'pino';
import { EmailQueue } from './email-queue.js';
import { InMemoryEmailSender } from './in-memory-email-sender.js';
import type { EmailSender, EmailMessage } from './email-sender.js';

function createSampleMessage(index: number): EmailMessage {
  return {
    to: `user${index}@unexample.edu.pe`,
    subject: `Asunto ${index}`,
    template: 'connectivity-check',
    variables: { code: `${index}` },
  };
}

describe('EmailQueue (RNF-018)', () => {
  it('enqueue returns immediately and does not wait for deliveries', async () => {
    let activeSendCalls = 0;
    const slowSender: EmailSender = {
      async send() {
        activeSendCalls++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        activeSendCalls--;
        return { messageId: 'msg-slow' };
      },
    };

    const queue = new EmailQueue({
      sender: slowSender,
      concurrency: 5,
    });

    const messages = Array.from({ length: 50 }, (_, i) => createSampleMessage(i));
    const start = Date.now();
    const result = queue.enqueue(messages);
    const elapsed = Date.now() - start;

    expect(result).toEqual({ accepted: 50 });
    // Devuelve casi de inmediato (menos de 20 ms), sin esperar los 50 * 50 ms
    expect(elapsed).toBeLessThan(35);

    await queue.drain();
    expect(activeSendCalls).toBe(0);
  });

  it('drain delivers all queued messages using the sender', async () => {
    const memorySender = new InMemoryEmailSender();
    const queue = new EmailQueue({
      sender: memorySender,
      concurrency: 4,
    });

    const messages = Array.from({ length: 20 }, (_, i) => createSampleMessage(i));
    queue.enqueue(messages);

    await queue.drain();

    const sent = memorySender.sent;
    expect(sent).toHaveLength(20);
    expect(sent[0]?.to).toBe('user0@unexample.edu.pe');
    expect(sent[19]?.to).toBe('user19@unexample.edu.pe');
  });

  it('respects concurrency limit', async () => {
    let currentConcurrent = 0;
    let maxObservedConcurrent = 0;

    const sender: EmailSender = {
      async send() {
        currentConcurrent++;
        if (currentConcurrent > maxObservedConcurrent) {
          maxObservedConcurrent = currentConcurrent;
        }
        await new Promise((resolve) => setTimeout(resolve, 15));
        currentConcurrent--;
        return { messageId: 'ok' };
      },
    };

    const queue = new EmailQueue({
      sender,
      concurrency: 3,
    });

    queue.enqueue(Array.from({ length: 15 }, (_, i) => createSampleMessage(i)));
    await queue.drain();

    expect(maxObservedConcurrent).toBeLessThanOrEqual(3);
    expect(maxObservedConcurrent).toBeGreaterThanOrEqual(1);
  });

  it('retries a failed message and delivers it on next attempt', async () => {
    let attempts = 0;
    const sender: EmailSender = {
      async send() {
        attempts++;
        if (attempts === 1) {
          throw new Error('Temporary queue delivery failure');
        }
        return { messageId: 'msg-retry-ok' };
      },
    };

    const sleepCalls: number[] = [];
    const queue = new EmailQueue({
      sender,
      concurrency: 2,
      maxAttempts: 2,
      retryDelayMs: 100,
      sleep: async (ms) => {
        sleepCalls.push(ms);
      },
    });

    queue.enqueue([createSampleMessage(1)]);
    await queue.drain();

    expect(attempts).toBe(2);
    expect(sleepCalls).toHaveLength(1);
    expect(sleepCalls[0]).toBe(100);
  });

  it('exhausts attempts, calls onFailure and does not block remaining messages', async () => {
    const failedMessages: { message: EmailMessage; error: unknown }[] = [];
    const delivered: string[] = [];

    const sender: EmailSender = {
      async send(msg) {
        if (msg.to.includes('failing')) {
          throw new Error('Persistent failure for test');
        }
        delivered.push(msg.to);
        return { messageId: 'ok' };
      },
    };

    const queue = new EmailQueue({
      sender,
      concurrency: 2,
      maxAttempts: 2,
      sleep: async () => {},
      onFailure: (message, error) => {
        failedMessages.push({ message, error });
      },
    });

    queue.enqueue([
      {
        to: 'good1@unexample.edu.pe',
        subject: 'S1',
        template: 'connectivity-check',
        variables: {},
      },
      {
        to: 'failing@unexample.edu.pe',
        subject: 'S2',
        template: 'connectivity-check',
        variables: {},
      },
      {
        to: 'good2@unexample.edu.pe',
        subject: 'S3',
        template: 'connectivity-check',
        variables: {},
      },
    ]);

    await queue.drain();

    expect(delivered).toEqual(['good1@unexample.edu.pe', 'good2@unexample.edu.pe']);
    expect(failedMessages).toHaveLength(1);
    expect(failedMessages[0]?.message.to).toBe('failing@unexample.edu.pe');
  });

  it('does not log full email addresses or personal data (Ley N 29733)', async () => {
    const loggedMessages: string[] = [];
    const mockLogger = {
      info: vi.fn((obj: Record<string, unknown> | string) => {
        loggedMessages.push(JSON.stringify(obj));
      }),
      warn: vi.fn((obj: Record<string, unknown> | string) => {
        loggedMessages.push(JSON.stringify(obj));
      }),
      error: vi.fn((obj: Record<string, unknown> | string) => {
        loggedMessages.push(JSON.stringify(obj));
      }),
      debug: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
      child: () => mockLogger,
    };

    const sender: EmailSender = {
      async send(msg) {
        if (msg.to.includes('fail')) {
          throw new Error('boom');
        }
        return { messageId: 'ok' };
      },
    };

    const queue = new EmailQueue({
      sender,
      logger: mockLogger as unknown as Logger,
      maxAttempts: 1,
      sleep: async () => {},
    });

    const sensitiveEmail = 'juan.perez.constituyente@empresa.com.pe';
    queue.enqueue([
      {
        to: sensitiveEmail,
        subject: 'Asunto secreto',
        template: 'connectivity-check',
        variables: {},
      },
      {
        to: 'fail.estudiante@unexample.edu.pe',
        subject: 'Error',
        template: 'connectivity-check',
        variables: {},
      },
    ]);

    await queue.drain();

    for (const log of loggedMessages) {
      expect(log).not.toContain(sensitiveEmail);
      expect(log).not.toContain('juan.perez');
      expect(log).not.toContain('fail.estudiante@unexample.edu.pe');
    }
  });

  it('drain resolves immediately if queue is empty', async () => {
    const memorySender = new InMemoryEmailSender();
    const queue = new EmailQueue({ sender: memorySender });

    await expect(queue.drain()).resolves.toBeUndefined();
  });

  it('can enqueue new messages after a previous drain', async () => {
    const memorySender = new InMemoryEmailSender();
    const queue = new EmailQueue({ sender: memorySender });

    queue.enqueue([createSampleMessage(1)]);
    await queue.drain();
    expect(memorySender.sent).toHaveLength(1);

    queue.enqueue([createSampleMessage(2)]);
    await queue.drain();
    expect(memorySender.sent).toHaveLength(2);
  });
});
