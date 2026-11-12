export interface SendPasswordResetEmailParams {
  to: string;
  names: string;
  rawToken: string;
  expiresAt: Date;
}

export interface PasswordResetEmailSender {
  send(params: SendPasswordResetEmailParams): Promise<void>;
}
