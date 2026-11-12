export interface SendActivationEmailParams {
  to: string;
  names: string;
  activationToken: string;
  expiresAt: Date;
}

export interface ActivationEmailSender {
  send(params: SendActivationEmailParams): Promise<void>;
}
