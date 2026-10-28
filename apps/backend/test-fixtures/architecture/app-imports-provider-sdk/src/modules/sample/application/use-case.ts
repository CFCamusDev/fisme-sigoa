import { Resend } from 'resend';

export class SendEmailUseCase {
  private readonly resend = new Resend('key');
}
