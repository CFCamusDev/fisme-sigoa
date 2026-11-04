import { describe, expect, it, vi } from 'vitest';
import { EmailDeliveryError } from './email-delivery-error.js';
import { describeEmailSenderContract } from './email-sender.integration.test.js';
import type { ResendClient } from './resend-email-sender.js';
import { extractDomain, ResendEmailSender } from './resend-email-sender.js';

describe('extractDomain', () => {
  it('extracts only domain from standard email address (Ley N° 29733)', () => {
    expect(extractDomain('usuario@untrim.edu.pe')).toBe('untrim.edu.pe');
    expect(extractDomain('profesor.investigador+tag@gmail.com')).toBe('gmail.com');
  });

  it('handles invalid addresses gracefully', () => {
    expect(extractDomain('invalid-address')).toBe('[unknown-domain]');
    expect(extractDomain('')).toBe('[unknown-domain]');
  });
});

describe('ResendEmailSender', () => {
  const dummyFrom = 'no-reply@untrim.edu.pe';
  const dummyTemplateRenderer = (template: string) => ({
    html: `<p>template: ${template}</p>`,
    text: `template: ${template}`,
  });

  function createMockLogger() {
    return {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  }

  it('delivers successfully and logs only domain and metadata without full email address', async () => {
    const fakeClient: ResendClient = {
      emails: {
        send: vi.fn().mockResolvedValue({
          data: { id: 'resend-msg-123' },
          error: null,
        }),
      },
    };
    const logger = createMockLogger();
    const sender = new ResendEmailSender({
      client: fakeClient,
      from: dummyFrom,
      renderer: dummyTemplateRenderer,
      logger,
      retryOptions: { maxAttempts: 3, baseDelayMs: 10, sleep: vi.fn() },
    });

    const result = await sender.send({
      to: 'docente@untrim.edu.pe',
      subject: 'Aprobación de acta',
      template: 'minutes-approval',
      variables: {},
    });

    expect(result).toEqual({ messageId: 'resend-msg-123' });
    expect(fakeClient.emails.send).toHaveBeenCalledTimes(1);

    // Verificación de protección de datos personales (Ley N° 29733)
    expect(logger.info).toHaveBeenCalledTimes(1);
    const logCalls = JSON.stringify(logger.info.mock.calls);
    expect(logCalls).toContain('untrim.edu.pe');
    expect(logCalls).not.toContain('docente@untrim.edu.pe');
  });

  it('logs the template version when sending an email (RN-004)', async () => {
    const fakeClient: ResendClient = {
      emails: {
        send: vi.fn().mockResolvedValue({
          data: { id: 'resend-msg-v1' },
          error: null,
        }),
      },
    };
    const logger = createMockLogger();
    const versionedRenderer = () => ({
      html: '<p>test</p>',
      text: 'test',
      templateVersion: 1,
    });
    const sender = new ResendEmailSender({
      client: fakeClient,
      from: dummyFrom,
      renderer: versionedRenderer,
      logger,
    });

    await sender.send({
      to: 'docente@untrm.edu.pe',
      subject: 'Test subject',
      template: 'test-template',
      variables: {},
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        template: 'test-template',
        templateVersion: 1,
      }),
      expect.any(String),
    );
  });

  it('retries transient 500 error from provider and succeeds on subsequent attempt', async () => {
    const transientError = { message: 'Internal provider outage', status: 500 };
    const fakeClient: ResendClient = {
      emails: {
        send: vi
          .fn()
          .mockResolvedValueOnce({ data: null, error: transientError })
          .mockResolvedValueOnce({ data: { id: 'recovered-id' }, error: null }),
      },
    };
    const logger = createMockLogger();
    const sleep = vi.fn().mockResolvedValue(undefined);
    const sender = new ResendEmailSender({
      client: fakeClient,
      from: dummyFrom,
      renderer: dummyTemplateRenderer,
      logger,
      retryOptions: { maxAttempts: 3, baseDelayMs: 20, sleep },
    });

    const result = await sender.send({
      to: 'test@example.com',
      subject: 'Retry Test',
      template: 'test',
      variables: {},
    });

    expect(result).toEqual({ messageId: 'recovered-id' });
    expect(fakeClient.emails.send).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('fails fast on 422 unprocessable entity without retrying', async () => {
    const unprocessable = { message: 'Invalid recipient address format', status: 422 };
    const fakeClient: ResendClient = {
      emails: {
        send: vi.fn().mockResolvedValue({ data: null, error: unprocessable }),
      },
    };
    const sleep = vi.fn();
    const sender = new ResendEmailSender({
      client: fakeClient,
      from: dummyFrom,
      renderer: dummyTemplateRenderer,
      retryOptions: { maxAttempts: 3, sleep },
    });

    await expect(
      sender.send({
        to: 'bad-email',
        subject: 'Bad',
        template: 'bad',
        variables: {},
      }),
    ).rejects.toThrowError(EmailDeliveryError);

    expect(fakeClient.emails.send).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('throws EmailDeliveryError when max retry attempts are exhausted without leaking credentials', async () => {
    const error500 = { message: 'Persistent outage', status: 503 };
    const fakeClient: ResendClient = {
      emails: {
        send: vi.fn().mockResolvedValue({ data: null, error: error500 }),
      },
    };
    const sleep = vi.fn().mockResolvedValue(undefined);
    const logger = createMockLogger();
    const sender = new ResendEmailSender({
      client: fakeClient,
      from: dummyFrom,
      renderer: dummyTemplateRenderer,
      logger,
      retryOptions: { maxAttempts: 3, sleep },
    });

    await expect(
      sender.send({
        to: 'user@example.com',
        subject: 'Exhausted',
        template: 'test',
        variables: {},
      }),
    ).rejects.toThrowError(EmailDeliveryError);

    expect(fakeClient.emails.send).toHaveBeenCalledTimes(3);
  });
});

// Verificación de contrato con el adaptador real de Resend usando cliente simulado
describeEmailSenderContract('ResendEmailSender (fake client)', () => {
  let counter = 0;
  const fakeClient: ResendClient = {
    emails: {
      send: vi.fn().mockImplementation(async () => {
        counter += 1;
        return { data: { id: `resend-${counter}` }, error: null };
      }),
    },
  };

  return new ResendEmailSender({
    client: fakeClient,
    from: 'sigoa@untrim.edu.pe',
    renderer: (template) => ({ html: `<p>${template}</p>`, text: template }),
  });
});
