import type { LogoUrlResolver } from '../../../../shared/branding/logo-url-resolver.js';
import type { EmailSender } from '../../../../shared/email/email-sender.js';
import { formatEmailDateTime } from '../../../../shared/email/format-email-date.js';
import type {
  ActivationEmailSender,
  SendActivationEmailParams,
} from '../../domain/ports/activation-email-sender.js';

export const formatActivationExpiry = formatEmailDateTime;

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
