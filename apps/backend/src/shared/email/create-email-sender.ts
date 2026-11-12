import { Resend } from 'resend';
import { EmailDeliveryError } from './email-delivery-error.js';
import type { EmailSender } from './email-sender.js';
import { InMemoryEmailSender } from './in-memory-email-sender.js';
import type { EmailSenderLogger } from './resend-email-sender.js';
import { ResendEmailSender } from './resend-email-sender.js';

export interface EmailSenderConfig {
  EMAIL_PROVIDER: 'resend' | 'memory';
  NODE_ENV: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

/**
 * Fábrica centralizada para instanciar el adaptador de correo vigente (RS-073, RNF-033).
 */
export function createEmailSender(
  config: EmailSenderConfig,
  logger?: EmailSenderLogger,
): EmailSender {
  if (config.EMAIL_PROVIDER === 'memory') {
    if (config.NODE_ENV === 'production') {
      throw new EmailDeliveryError(
        'El adaptador de correo en memoria no está permitido en producción',
      );
    }
    return new InMemoryEmailSender();
  }

  if (config.EMAIL_PROVIDER === 'resend') {
    if (!config.RESEND_API_KEY || !config.EMAIL_FROM) {
      throw new EmailDeliveryError(
        'Configuración incompleta: RESEND_API_KEY y EMAIL_FROM son obligatorios para el proveedor resend',
      );
    }

    const resend = new Resend(config.RESEND_API_KEY);
    return new ResendEmailSender({
      client: resend,
      from: config.EMAIL_FROM,
      logger,
    });
  }

  throw new EmailDeliveryError(
    `Proveedor de correo no soportado: ${String(config.EMAIL_PROVIDER)}`,
  );
}
