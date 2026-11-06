import { describe, expect, it, vi } from 'vitest';
import type { EmailMessage, EmailSender } from '../../../../shared/email/email-sender.js';
import { LogoUrlResolver } from '../../../../shared/branding/logo-url-resolver.js';
import { EmailPasswordResetSender } from './email-password-reset-sender.js';

describe('EmailPasswordResetSender Adapter (T-005-04, RN-004, RF-005, RS-005)', () => {
  const publicAppUrl = 'https://sigoa.untrm.edu.pe';
  const logoResolver = new LogoUrlResolver(publicAppUrl);

  it('builds reset url, formats date in America/Lima, resolves logo and sends password-reset template', async () => {
    let sentMessage: EmailMessage | null = null;
    const mockEmailSender: EmailSender = {
      send: vi.fn().mockImplementation(async (msg: EmailMessage) => {
        sentMessage = msg;
        return { messageId: 'mock-reset-msg-1' };
      }),
    };

    const adapter = new EmailPasswordResetSender({
      emailSender: mockEmailSender,
      publicAppUrl,
      logoUrlResolver: logoResolver,
    });

    // 2026-11-06T19:30:00Z equivale a 14:30 en Lima
    const expiresAt = new Date('2026-11-06T19:30:00.000Z');
    await adapter.send({
      to: 'docente@untrm.edu.pe',
      names: 'Carlos Alberto',
      rawToken: 'raw-token-123+special/token==',
      expiresAt,
    });

    expect(mockEmailSender.send).toHaveBeenCalledTimes(1);
    expect(sentMessage).toBeDefined();
    const msg = sentMessage as unknown as EmailMessage;
    expect(msg.to).toBe('docente@untrm.edu.pe');
    expect(msg.subject).toBe('Restablece tu contraseña de FISME-SIGOA');
    expect(msg.template).toBe('password-reset');

    // Debe codificar caracteres reservados en la URL
    expect(msg.variables['resetUrl']).toBe(
      'https://sigoa.untrm.edu.pe/restablecer/raw-token-123%2Bspecial%2Ftoken%3D%3D',
    );
    expect(msg.variables['names']).toBe('Carlos Alberto');
    expect(msg.variables['expiresAt']).toBe('06/11/2026 14:30');
    expect(msg.variables['logoUrl']).toBe(
      'https://sigoa.untrm.edu.pe/assets/logo-untrm-v1-256.png',
    );
  });

  it('normalizes trailing slashes in publicAppUrl', async () => {
    let sentMessage: EmailMessage | null = null;
    const mockEmailSender: EmailSender = {
      send: vi.fn().mockImplementation(async (msg: EmailMessage) => {
        sentMessage = msg;
        return { messageId: 'mock-reset-msg-2' };
      }),
    };

    const adapter = new EmailPasswordResetSender({
      emailSender: mockEmailSender,
      publicAppUrl: 'https://sigoa.untrm.edu.pe///',
      logoUrlResolver: logoResolver,
    });

    await adapter.send({
      to: 'estudiante@untrm.edu.pe',
      names: 'Ana Lucía',
      rawToken: 'token456',
      expiresAt: new Date('2026-11-06T15:00:00.000Z'),
    });

    const msg = sentMessage as unknown as EmailMessage;
    expect(msg.variables['resetUrl']).toBe('https://sigoa.untrm.edu.pe/restablecer/token456');
  });

  it('propagates email sender errors when sending fails', async () => {
    const mockEmailSender: EmailSender = {
      send: vi.fn().mockRejectedValue(new Error('Resend SMTP connection failed')),
    };

    const adapter = new EmailPasswordResetSender({
      emailSender: mockEmailSender,
      publicAppUrl,
      logoUrlResolver: logoResolver,
    });

    await expect(
      adapter.send({
        to: 'docente@untrm.edu.pe',
        names: 'Carlos',
        rawToken: 'token-err',
        expiresAt: new Date(),
      }),
    ).rejects.toThrow('Resend SMTP connection failed');
  });
});
