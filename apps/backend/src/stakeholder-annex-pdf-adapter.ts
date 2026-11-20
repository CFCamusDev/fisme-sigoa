import type { AnnexPdfGenerator } from './modules/stakeholders/index.js';
import type { GenerateAnnexPdfUseCase } from './modules/templates/index.js';

/**
 * Adaptador de composición entre `stakeholders` y `templates` (D4, D5):
 * reutiliza la instancia compartida de `GenerateAnnexPdfUseCase` para conservar el límite por usuario.
 */
export function createStakeholderAnnexPdfGenerator(
  generateAnnexPdfUseCase: GenerateAnnexPdfUseCase,
): AnnexPdfGenerator {
  return {
    async generate(input) {
      const result = await generateAnnexPdfUseCase.execute({
        actorId: input.actorId,
        ip: input.ip,
        annexCode: input.annexCode,
        data: input.data,
        fileLabel: input.fileLabel,
        subject: input.subject,
      });

      return {
        pdf: result.pdf,
        fileName: result.fileName,
        templateCode: result.templateCode,
        versionNumber: result.versionNumber,
      };
    },
  };
}
