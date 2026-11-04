import type { z } from 'zod';

export interface RenderedEmail {
  html: string;
  text: string;
  templateVersion?: number;
}

export type EmailTemplateRenderer = (
  template: string,
  variables: Record<string, unknown>,
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

export interface TemplateDefinition<T = Record<string, unknown>> {
  readonly version: number;
  readonly variablesSchema: z.ZodType<T>;
  readonly render: (variables: T) => { html: string; text: string };
}
