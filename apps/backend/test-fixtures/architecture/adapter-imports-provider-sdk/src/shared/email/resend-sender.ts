import { Resend } from 'resend';

export class ResendEmailSender {
  private readonly resend = new Resend('key');
}
