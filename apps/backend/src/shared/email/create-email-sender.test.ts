import { describe, expect, it } from 'vitest';
import { createEmailSender } from './create-email-sender.js';
import { EmailDeliveryError } from './email-delivery-error.js';
import { InMemoryEmailSender } from './in-memory-email-sender.js';
import { ResendEmailSender } from './resend-email-sender.js';

describe('createEmailSender', () => {
  it('creates an InMemoryEmailSender when provider is memory in development or test', () => {
    const sender = createEmailSender({
      EMAIL_PROVIDER: 'memory',
      NODE_ENV: 'development',
    });

    expect(sender).toBeInstanceOf(InMemoryEmailSender);
  });

  it('throws EmailDeliveryError when memory provider is requested in production', () => {
    expect(() =>
      createEmailSender({
        EMAIL_PROVIDER: 'memory',
        NODE_ENV: 'production',
      }),
    ).toThrowError(EmailDeliveryError);
  });

  it('creates a ResendEmailSender when provider is resend with valid credentials', () => {
    const sender = createEmailSender({
      EMAIL_PROVIDER: 'resend',
      NODE_ENV: 'development',
      RESEND_API_KEY: 're_dummy_123',
      EMAIL_FROM: 'no-reply@untrim.edu.pe',
    });

    expect(sender).toBeInstanceOf(ResendEmailSender);
  });

  it('throws EmailDeliveryError when resend is selected but credentials are missing', () => {
    expect(() =>
      createEmailSender({
        EMAIL_PROVIDER: 'resend',
        NODE_ENV: 'development',
      }),
    ).toThrowError(EmailDeliveryError);
  });
});
