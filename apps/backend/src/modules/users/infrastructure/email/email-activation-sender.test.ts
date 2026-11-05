import { describe, expect, it, vi } from 'vitest';
import type { EmailSender, EmailMessage } from '../../../../shared/email/email-sender.js';
import { LogoUrlResolver } from '../../../../shared/branding/logo-url-resolver.js';
import { EmailActivationSender, formatActivationExpiry } from './email-activation-sender.js';

describe('EmailActivationSender Adapter (T-003-08, RN-004, RS-016)', () => {
  const publicAppUrl = 'https://sigoa.untrm.edu.pe';
  const logoResolver = new LogoUrlResolver(publicAppUrl);

  it('formats the expiry in es-PE and America/Lima time deterministically', () => {
    // 2026-11-05T19:30:00Z en UTC equivale a las 14:30 en America/Lima (UTC-5)
    const utcDate = new Date('2026-11-05T19:30:00.000Z');
    const formatted = formatActivationExpiry(utcDate);
    expect(formatted).toBe('05/11/2026 14:30');
  });

  it('builds the activation url, uses official logo and sends the account-activation template', async () => {
    let sentMessage: EmailMessage | null = null;
    const mockEmailSender: EmailSender = {
      send: vi.fn().mockImplementation(async (msg: EmailMessage) => {
        sentMessage = msg;
        return { messageId: 'mock-msg-123' };
      }),
    };

    const adapter = new EmailActivationSender({
      emailSender: mockEmailSender,
      publicAppUrl,
      logoUrlResolver: logoResolver,
    });

    const expiresAt = new Date('2026-11-05T19:30:00.000Z');
    await adapter.send({
      to: 'docente@untrm.edu.pe',
      names: 'Carlos Alberto',
      activationToken: 'raw-token-123+xyz==',
      expiresAt,
    });

    expect(mockEmailSender.send).toHaveBeenCalledTimes(1);
    expect(sentMessage).toBeDefined();
    const msg = sentMessage as unknown as EmailMessage;
    expect(msg.to).toBe('docente@untrm.edu.pe');
    expect(msg.subject).toBe('Activa tu cuenta en FISME-SIGOA');
    expect(msg.template).toBe('account-activation');

    // URL debe codificar caracteres especiales como + y =
    expect(msg.variables['activationUrl']).toBe(
      'https://sigoa.untrm.edu.pe/activar/raw-token-123%2Bxyz%3D%3D',
    );
    expect(msg.variables['names']).toBe('Carlos Alberto');
    expect(msg.variables['email']).toBe('docente@untrm.edu.pe');
    expect(msg.variables['expiresAt']).toBe('05/11/2026 14:30');
    expect(msg.variables['logoUrl']).toBe(
      'https://sigoa.untrm.edu.pe/assets/logo-untrm-v1-256.png',
    );
  });

  it('propagates provider failures when email sender throws', async () => {
    const mockEmailSender: EmailSender = {
      send: vi.fn().mockRejectedValue(new Error('SMTP connection timed out')),
    };

    const adapter = new EmailActivationSender({
      emailSender: mockEmailSender,
      publicAppUrl,
      logoUrlResolver: logoResolver,
    });

    await expect(
      adapter.send({
        to: 'fallo@untrm.edu.pe',
        names: 'Usuario Prueba',
        activationToken: 'token',
        expiresAt: new Date(),
      }),
    ).rejects.toThrow('SMTP connection timed out');
  });
});
