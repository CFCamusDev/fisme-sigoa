import { describe, expect, it } from 'vitest';
import { EmailDeliveryError } from './email-delivery-error.js';
import {
  defaultEmailTemplateRenderer,
  escapeHtml,
  renderEmailTemplate,
} from './email-templates.js';

describe('escapeHtml', () => {
  it('escapes dangerous HTML characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
    expect(escapeHtml("Tom & 'Jerry'")).toBe('Tom &amp; &#39;Jerry&#39;');
  });

  it('handles numbers and booleans correctly', () => {
    expect(escapeHtml(123)).toBe('123');
    expect(escapeHtml(true)).toBe('true');
  });
});

describe('Email Templates (RN-004, RS-073)', () => {
  it('renders a registered template and returns its version', () => {
    const rendered = renderEmailTemplate('connectivity-check', {
      environment: 'staging',
    });

    expect(rendered.templateVersion).toBe(1);
    expect(rendered.html).toContain('staging');
    expect(rendered.text).toContain('staging');
  });

  it('rejects variables that do not match the template schema without echoing their values', () => {
    const secretValue = 'VERY_SECRET_FORBIDDEN_VALUE_123';
    // environment espera string, pasar un tipo inválido (ej: number o valor que falle validación si fuera restringido)
    expect(() =>
      renderEmailTemplate('connectivity-check', {
        environment: 12345 as unknown as string,
        secretTrigger: secretValue,
      }),
    ).toThrowError(EmailDeliveryError);

    try {
      renderEmailTemplate('connectivity-check', {
        environment: 12345 as unknown as string,
        secretTrigger: secretValue,
      });
    } catch (err: unknown) {
      const message = (err as Error).message;
      expect(message).toContain('environment');
      expect(message).not.toContain(secretValue);
      expect(message).not.toContain('12345');
    }
  });

  it('keeps the legacy renderer working as an alias', () => {
    const rendered = defaultEmailTemplateRenderer('connectivity-check', {
      environment: 'production',
    });
    expect(rendered.html).toContain('production');
    expect(rendered.templateVersion).toBe(1);
  });

  it('throws EmailDeliveryError when template key is unknown', () => {
    expect(() => renderEmailTemplate('unknown-template', {})).toThrowError(EmailDeliveryError);
    expect(() => renderEmailTemplate('unknown-template', {})).toThrowError(
      /Plantilla de correo no encontrada/,
    );
  });
});
