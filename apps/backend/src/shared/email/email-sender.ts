export interface EmailMessage {
  to: string;
  subject: string;
  template: string;
  variables: Record<string, string | number | boolean>;
}

export interface EmailSendResult {
  messageId: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
