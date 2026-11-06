import { z } from 'zod';
import { EmailDeliveryError } from './email-delivery-error.js';
import { accountActivationTemplate } from './templates/account-activation.js';
import { passwordResetTemplate } from './templates/password-reset.js';
import {
  escapeHtml,
  type EmailTemplateRenderer,
  type RenderedEmail,
  type TemplateDefinition,
} from './template-types.js';

export * from './template-types.js';
export { accountActivationTemplate } from './templates/account-activation.js';
export { passwordResetTemplate } from './templates/password-reset.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TEMPLATE_REGISTRY = new Map<string, TemplateDefinition<any>>([
  [
    'connectivity-check',
    {
      version: 1,
      variablesSchema: z.object({
        environment: z.string().optional(),
      }),
      render: (vars: { environment?: string }) => {
        const envEscaped = escapeHtml(vars.environment ?? 'desarrollo');
        const envPlain = String(vars.environment ?? 'desarrollo');
        return {
          html: `<p>Hola, este es un mensaje de prueba de conectividad de FISME-SIGOA para el entorno <strong>${envEscaped}</strong>.</p>`,
          text: `Hola, este es un mensaje de prueba de conectividad de FISME-SIGOA para el entorno ${envPlain}.`,
        };
      },
    },
  ],
  ['account-activation', accountActivationTemplate],
  ['password-reset', passwordResetTemplate],
]);

/**
 * Registra o sobreescribe una definición de plantilla de correo versionada.
 */
export function registerEmailTemplate<T>(name: string, definition: TemplateDefinition<T>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TEMPLATE_REGISTRY.set(name, definition as TemplateDefinition<any>);
}

/**
 * Renderiza una plantilla validando sus variables con Zod y retornando su versión (RN-004, RS-073).
 */
export function renderEmailTemplate(
  template: string,
  variables: Record<string, unknown>,
): RenderedEmail & { templateVersion: number } {
  const definition = TEMPLATE_REGISTRY.get(template);
  if (!definition) {
    throw new EmailDeliveryError(`Plantilla de correo no encontrada: ${template}`);
  }

  const parseResult = definition.variablesSchema.safeParse(variables);
  if (!parseResult.success) {
    const errorPaths = parseResult.error.issues
      .map((issue) => issue.path.join('.') || issue.message)
      .join(', ');
    throw new EmailDeliveryError(
      `Variables inválidas para la plantilla ${template}: ${errorPaths}`,
    );
  }

  const rendered = definition.render(parseResult.data);
  return {
    html: rendered.html,
    text: rendered.text,
    templateVersion: definition.version,
  };
}

/**
 * Renderizador de plantillas por defecto del sistema (RN-004, RS-073).
 */
export const defaultEmailTemplateRenderer: EmailTemplateRenderer = (template, variables) => {
  return renderEmailTemplate(template, variables);
};
