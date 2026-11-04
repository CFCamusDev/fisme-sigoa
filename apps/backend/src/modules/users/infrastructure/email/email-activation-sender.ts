import type { LogoUrlResolver } from '../../../../shared/branding/logo-url-resolver.js';
import type { EmailSender } from '../../../../shared/email/email-sender.js';
import type {
  ActivationEmailSender,
  SendActivationEmailParams,
} from '../../domain/ports/activation-email-sender.js';

export function formatActivationExpiry(date: Date): string {
  const formatter = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }
  return `${partMap['day']}/${partMap['month']}/${partMap['year']} ${partMap['hour']}:${partMap['minute']}`;
}

export interface EmailActivationSenderDependencies {
  emailSender: EmailSender;
  publicAppUrl: string;
  logoUrlResolver: LogoUrlResolver;
}

export class EmailActivationSender implements ActivationEmailSender {
  private readonly emailSender: EmailSender;
  private readonly publicAppUrl: string;
  private readonly logoUrlResolver: LogoUrlResolver;

  constructor(deps: EmailActivationSenderDependencies) {
    this.emailSender = deps.emailSender;
    this.publicAppUrl = deps.publicAppUrl.replace(/\/+$/, '');
    this.logoUrlResolver = deps.logoUrlResolver;
  }

  async send(params: SendActivationEmailParams): Promise<void> {
    const encodedToken = encodeURIComponent(params.activationToken);
    const activationUrl = `${this.publicAppUrl}/activar/${encodedToken}`;
    const logoUrl = this.logoUrlResolver.resolve('square');
    const formattedExpiresAt = formatActivationExpiry(params.expiresAt);

    await this.emailSender.send({
      to: params.to,
      subject: 'Activa tu cuenta en FISME-SIGOA',
      template: 'account-activation',
      variables: {
        names: params.names,
        email: params.to,
        activationUrl,
        expiresAt: formattedExpiresAt,
        logoUrl,
      },
    });
  }
}
