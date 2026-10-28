import { describe, expect, it } from 'vitest';
import type { EmailMessage, EmailSender } from './email-sender.js';
import { InMemoryEmailSender } from './in-memory-email-sender.js';

/**
 * Suite de contrato parametrizable para EmailSender (RS-073, RNF-033).
 *
 * Reutilizable en el Tramo 2 con el adaptador real de Resend sin modificar
 * los casos de uso consumidores.
 */
export function describeEmailSenderContract(
  adapterName: string,
  factory: () => Promise<EmailSender> | EmailSender,
): void {
  describe(`EmailSender Contract: ${adapterName}`, () => {
    it('delivers through the port without provider coupling and returns messageId', async () => {
      const sender = await factory();
      const message: EmailMessage = {
        to: 'coordinador@untrim.edu.pe',
        subject: 'Convocatoria a reunión de Comité de Calidad',
        template: 'quality-committee-notice',
        variables: {
          period: '2026-I',
          meetingDate: '2026-11-05',
        },
      };

      const result = await sender.send(message);

      expect(result).toBeDefined();
      expect(typeof result.messageId).toBe('string');
      expect(result.messageId.length).toBeGreaterThan(0);
    });

    it('allows an application use-case to depend solely on the EmailSender interface (CA1)', async () => {
      // Caso de uso de ejemplo desacoplado que satisface CA1
      class SendValidationInvitationUseCase {
        constructor(private readonly emailSender: EmailSender) {}

        async execute(dto: { recipientEmail: string; surveyToken: string }): Promise<string> {
          const res = await this.emailSender.send({
            to: dto.recipientEmail,
            subject: 'Invitación a encuesta de validación',
            template: 'survey-invitation',
            variables: { token: dto.surveyToken },
          });
          return res.messageId;
        }
      }

      const sender = await factory();
      const useCase = new SendValidationInvitationUseCase(sender);

      const messageId = await useCase.execute({
        recipientEmail: 'empleador@empresa.pe',
        surveyToken: 'tok-abc-123',
      });

      expect(messageId).toBeDefined();
    });
  });
}

// Ejecución del contrato con el adaptador en memoria (sin servicios externos ni BD)
describeEmailSenderContract('InMemoryEmailSender', () => new InMemoryEmailSender());
