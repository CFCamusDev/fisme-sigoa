import { EmailDeliveryError } from './email-delivery-error.js';

export interface RenderedEmail {
  html: string;
  text: string;
}

export type EmailTemplateRenderer = (
  template: string,
  variables: Record<string, string | number | boolean>,
) => RenderedEmail;

/**
 * Escapa caracteres especiales de HTML para prevenir inyecciones.
 */
export function escapeHtml(value: string | number | boolean): string {
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type TemplateDefinition = {
  render: (variables: Record<string, string | number | boolean>) => RenderedEmail;
};

const TEMPLATE_REGISTRY = new Map<string, TemplateDefinition>([
  [
    'connectivity-check',
    {
      render: (vars) => {
        const envEscaped = escapeHtml(vars['environment'] ?? 'desarrollo');
        const envPlain = String(vars['environment'] ?? 'desarrollo');
        return {
          html: `<p>Hola, este es un mensaje de prueba de conectividad de FISME-SIGOA para el entorno <strong>${envEscaped}</strong>.</p>`,
          text: `Hola, este es un mensaje de prueba de conectividad de FISME-SIGOA para el entorno ${envPlain}.`,
        };
      },
    },
  ],
]);

/**
 * Renderizador de plantillas por defecto del sistema (RN-004, RS-073).
 */
export const defaultEmailTemplateRenderer: EmailTemplateRenderer = (template, variables) => {
  const definition = TEMPLATE_REGISTRY.get(template);
  if (!definition) {
    throw new EmailDeliveryError(`Plantilla de correo no encontrada: ${template}`);
  }
  return definition.render(variables);
};
