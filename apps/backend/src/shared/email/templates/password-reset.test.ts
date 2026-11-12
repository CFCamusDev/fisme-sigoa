import { describe, expect, it } from 'vitest';
import { passwordResetTemplate } from './password-reset.js';
import { renderEmailTemplate } from '../email-templates.js';
import { EMAIL_THEME } from './account-activation.js';

describe('Password Reset Email Template (T-005-04, RN-004, RF-005, RS-005)', () => {
  const validVariables = {
    names: 'Carlos Mendoza',
    resetUrl: 'https://sigoa.untrm.edu.pe/restablecer/secure-reset-token-98765',
    expiresAt: '08/11/2026 10:30',
    logoUrl: 'https://res.cloudinary.com/fisme-sigoa/logo-square.png',
  };

  it('renders the reset link, the official logo and the expiry notice', () => {
    const rendered = passwordResetTemplate.render(validVariables);

    expect(rendered.html).toContain(validVariables.resetUrl);
    expect(rendered.html).toContain(validVariables.logoUrl);
    expect(rendered.html).toContain(validVariables.expiresAt);
    expect(rendered.html).toContain(validVariables.names);
    expect(rendered.html).toContain('Restablece tu contraseña');
    expect(rendered.html).toContain('Crear nueva contraseña');
    expect(rendered.html).toContain('Este enlace es de un solo uso');
    expect(rendered.html).toContain('tu contraseña actual seguirá funcionando');
  });

  it('escapes every variable to prevent HTML injection', () => {
    const dangerousVariables = {
      names: '<script>alert("xss")</script> Pedro & Rosa',
      resetUrl: 'https://sigoa.untrm.edu.pe/restablecer/token?param="test"',
      expiresAt: '08/11/2026 <strong>10:30</strong>',
      logoUrl: 'https://sigoa.untrm.edu.pe/logo.png?v="1"',
    };

    const rendered = passwordResetTemplate.render(dangerousVariables);

    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(rendered.html).toContain('Pedro &amp; Rosa');
    expect(rendered.html).toContain('&quot;test&quot;');
    expect(rendered.html).toContain('&lt;strong&gt;10:30&lt;/strong&gt;');
  });

  it('provides a plain text alternative with the link and instructions', () => {
    const rendered = passwordResetTemplate.render(validVariables);

    expect(rendered.text).toContain(validVariables.resetUrl);
    expect(rendered.text).toContain(validVariables.names);
    expect(rendered.text).toContain(validVariables.expiresAt);
    expect(rendered.text).toContain('Restablece tu contraseña');
    expect(rendered.text).toContain(
      'Universidad Nacional Toribio Rodríguez de Mendoza de Amazonas',
    );
  });

  it('uses only colors declared in EMAIL_THEME', () => {
    const rendered = passwordResetTemplate.render(validVariables);

    const hexColorRegex = /#[0-9a-fA-F]{3,6}\b/g;
    const foundColors = (rendered.html.match(hexColorRegex) || []).map((c) => c.toUpperCase());
    const allowedColors = Object.values(EMAIL_THEME).map((c) => c.toUpperCase());

    for (const color of foundColors) {
      expect(allowedColors).toContain(color);
    }
  });

  it('contains no dni, password or sensitive personal data', () => {
    const rendered = passwordResetTemplate.render(validVariables);
    const combined = (rendered.html + rendered.text).toLowerCase();

    expect(combined).not.toContain('dni');
    expect(combined).not.toContain('supersecret');
    expect(combined).not.toContain('contraseña actual:');
  });

  it('rejects variables that are not a url for resetUrl or logoUrl', () => {
    const invalidUrlVars = {
      ...validVariables,
      resetUrl: 'not-a-valid-url',
    };

    const parsed = passwordResetTemplate.variablesSchema.safeParse(invalidUrlVars);
    expect(parsed.success).toBe(false);

    const invalidLogoVars = {
      ...validVariables,
      logoUrl: 'not-a-valid-logo-url',
    };
    expect(passwordResetTemplate.variablesSchema.safeParse(invalidLogoVars).success).toBe(false);
  });

  it('is registered with version 1 and reports the template version', () => {
    const rendered = renderEmailTemplate('password-reset', validVariables);

    expect(rendered.templateVersion).toBe(1);
    expect(rendered.html).toContain(validVariables.resetUrl);
    expect(rendered.text).toContain(validVariables.resetUrl);
  });
});
