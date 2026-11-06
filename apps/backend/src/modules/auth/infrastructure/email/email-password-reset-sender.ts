import type { LogoUrlResolver } from '../../../../shared/branding/logo-url-resolver.js';
import type { EmailSender } from '../../../../shared/email/email-sender.js';
import { formatEmailDateTime } from '../../../../shared/email/format-email-date.js';
import type {
  PasswordResetEmailSender,
  SendPasswordResetEmailParams,
} from '../../domain/ports/password-reset-email-sender.js';

export interface EmailPasswordResetSenderDependencies {
  emailSender: EmailSender;
  publicAppUrl: string;
  logoUrlResolver: LogoUrlResolver;
}

export class EmailPasswordResetSender implements PasswordResetEmailSender {
  private readonly emailSender: EmailSender;
  private readonly publicAppUrl: string;
  private readonly logoUrlResolver: LogoUrlResolver;

  constructor(deps: EmailPasswordResetSenderDependencies) {
    this.emailSender = deps.emailSender;
    this.publicAppUrl = deps.publicAppUrl.replace(/\/+$/, '');
    this.logoUrlResolver = deps.logoUrlResolver;
  }

  async send(params: SendPasswordResetEmailParams): Promise<void> {
    const encodedToken = encodeURIComponent(params.rawToken);
    const resetUrl = `${this.publicAppUrl}/restablecer/${encodedToken}`;
    const logoUrl = this.logoUrlResolver.resolve('square');
    const formattedExpiresAt = formatEmailDateTime(params.expiresAt);

    await this.emailSender.send({
      to: params.to,
      subject: 'Restablece tu contraseña de FISME-SIGOA',
      template: 'password-reset',
      variables: {
        names: params.names,
        resetUrl,
        expiresAt: formattedExpiresAt,
        logoUrl,
      },
    });
  }
}
