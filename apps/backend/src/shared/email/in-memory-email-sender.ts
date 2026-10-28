import type { EmailMessage, EmailSender, EmailSendResult } from './email-sender.js';

function cloneVariables(
  variables: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  return { ...variables };
}

/**
 * Adaptador en memoria del puerto EmailSender (RS-073, RNF-033).
 *
 * Permite a los casos de uso y pruebas verificar correos "enviados"
 * sin depender de servicios externos ni red.
 */
export class InMemoryEmailSender implements EmailSender {
  private readonly _sent: EmailMessage[] = [];
  private _counter = 0;

  /**
   * Permite configurar un error para simular fallos del proveedor en pruebas.
   */
  public simulateFailure: Error | null = null;

  /**
   * Lista inmutable de mensajes enviados en orden de invocación.
   */
  get sent(): readonly EmailMessage[] {
    return this._sent.map((msg) => ({
      ...msg,
      variables: cloneVariables(msg.variables),
    }));
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (this.simulateFailure) {
      throw this.simulateFailure;
    }

    const defensiveCopy: EmailMessage = {
      ...message,
      variables: cloneVariables(message.variables),
    };

    this._sent.push(defensiveCopy);
    this._counter += 1;

    return {
      messageId: `email-${this._counter}`,
    };
  }

  /**
   * Limpia los mensajes acumulados, el contador y el error simulado.
   */
  clear(): void {
    this._sent.length = 0;
    this._counter = 0;
    this.simulateFailure = null;
  }
}
