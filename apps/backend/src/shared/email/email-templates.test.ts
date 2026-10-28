import { describe, expect, it } from 'vitest';
import { EmailDeliveryError } from './email-delivery-error.js';
import { defaultEmailTemplateRenderer, escapeHtml } from './email-templates.js';

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

describe('defaultEmailTemplateRenderer', () => {
  it('renders connectivity-check template with html and text versions and escaped variables', () => {
    const rendered = defaultEmailTemplateRenderer('connectivity-check', {
      environment: 'staging <test>',
      timestamp: '2026-10-28',
    });

    expect(rendered.html).toContain('staging &lt;test&gt;');
    expect(rendered.html).toContain('<p>');
    expect(rendered.text).toContain('staging <test>');
  });

  it('throws EmailDeliveryError when template key is unknown', () => {
    expect(() => defaultEmailTemplateRenderer('unknown-template', {})).toThrowError(
      EmailDeliveryError,
    );
    expect(() => defaultEmailTemplateRenderer('unknown-template', {})).toThrowError(
      /Plantilla de correo no encontrada/,
    );
  });
});
