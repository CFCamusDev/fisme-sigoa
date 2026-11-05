import { EmailDeliveryError } from './email-delivery-error.js';
import type { EmailMessage, EmailSender, EmailSendResult } from './email-sender.js';
import type { EmailTemplateRenderer } from './email-templates.js';
import { defaultEmailTemplateRenderer } from './email-templates.js';
import type { RetryOptions } from './retry.js';
import { withRetry } from './retry.js';

export interface ResendSendEmailPayload {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface ResendSendEmailResponse {
  data: { id: string } | null;
  error: { message: string; name?: string; status?: number; statusCode?: number } | Error | null;
}

export interface ResendClient {
  emails: {
    send(payload: ResendSendEmailPayload): Promise<ResendSendEmailResponse>;
  };
}

export interface EmailSenderLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

export interface ResendEmailSenderOptions {
  client: ResendClient;
  from: string;
  renderer?: EmailTemplateRenderer;
  logger?: EmailSenderLogger;
  retryOptions?: RetryOptions;
}

/**
 * Extrae únicamente el dominio de un correo electrónico para salvaguardar
 * los datos personales en los logs técnicos (Ley N° 29733).
 */
export function extractDomain(email: string): string {
  if (!email || !email.includes('@')) {
    return '[unknown-domain]';
  }
  const parts = email.split('@');
  return parts[parts.length - 1]?.trim().toLowerCase() || '[unknown-domain]';
}

/**
 * Adaptador de correo electrónico basado en Resend (RS-073, RNF-010, RNF-033).
 *
 * Implementa reintentos exponenciales para fallos transitorios y registro
 * de eventos respetando la privacidad de los destinatarios.
 */
export class ResendEmailSender implements EmailSender {
  private readonly client: ResendClient;
  private readonly from: string;
  private readonly renderer: EmailTemplateRenderer;
  private readonly logger?: EmailSenderLogger;
  private readonly retryOptions: RetryOptions;

  constructor(options: ResendEmailSenderOptions) {
    this.client = options.client;
    this.from = options.from;
    this.renderer = options.renderer ?? defaultEmailTemplateRenderer;
    this.logger = options.logger;
    this.retryOptions = options.retryOptions ?? { maxAttempts: 3, baseDelayMs: 300 };
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const rendered = this.renderer(message.template, message.variables);
    const domain = extractDomain(message.to);

    try {
      const result = await withRetry(async (attempt) => {
        const response = await this.client.emails.send({
          from: this.from,
          to: message.to,
          subject: message.subject,
          html: rendered.html,
          text: rendered.text,
        });

        if (response.error) {
          const errObj = response.error;
          const status =
            'status' in errObj && typeof errObj.status === 'number'
              ? errObj.status
              : 'statusCode' in errObj && typeof errObj.statusCode === 'number'
                ? errObj.statusCode
                : 500;

          const error = Object.assign(new Error(errObj.message || 'Error del proveedor Resend'), {
            status,
            name: 'name' in errObj && errObj.name ? errObj.name : 'ResendError',
          });

          this.logger?.warn(
            {
              domain,
              template: message.template,
              templateVersion: rendered.templateVersion,
              attempt,
              status,
              errorName: error.name,
            },
            'Fallo transitorio o error devuelto por el proveedor de correo',
          );

          throw error;
        }

        if (!response.data || !response.data.id) {
          throw Object.assign(new Error('Resend no retornó un identificador de mensaje válido'), {
            status: 500,
          });
        }

        return {
          messageId: response.data.id,
          attempts: attempt,
        };
      }, this.retryOptions);

      this.logger?.info(
        {
          messageId: result.messageId,
          template: message.template,
          templateVersion: rendered.templateVersion,
          domain,
          attempts: result.attempts,
        },
        'Correo electrónico enviado satisfactoriamente',
      );

      return {
        messageId: result.messageId,
      };
    } catch (error) {
      this.logger?.error(
        {
          domain,
          template: message.template,
          templateVersion: rendered.templateVersion,
          error: error instanceof Error ? error.message : String(error),
        },
        'Error definitivo al intentar enviar el correo electrónico',
      );

      throw new EmailDeliveryError('Error al enviar el correo electrónico', error);
    }
  }
}
