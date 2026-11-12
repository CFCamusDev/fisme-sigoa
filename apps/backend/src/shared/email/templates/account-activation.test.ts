import { describe, expect, it } from 'vitest';
import { accountActivationTemplate, EMAIL_THEME } from './account-activation.js';

describe('Account Activation Email Template (RN-004, RS-016, RNF-010)', () => {
  const validVariables = {
    names: 'Ana María',
    email: 'ana.maria@untrm.edu.pe',
    activationUrl: 'https://sigoa.untrm.edu.pe/activar/secure-token-12345',
    expiresAt: '05/11/2026 14:00',
    logoUrl: 'https://res.cloudinary.com/fisme-sigoa/logo-square.png',
  };

  it('renders the activation link, the logo and the expiry notice', () => {
    const rendered = accountActivationTemplate.render(validVariables);

    expect(rendered.html).toContain(validVariables.activationUrl);
    expect(rendered.html).toContain(validVariables.logoUrl);
    expect(rendered.html).toContain(validVariables.expiresAt);
    expect(rendered.html).toContain(validVariables.names);
    expect(rendered.html).toContain(validVariables.email);
    expect(rendered.html).toContain('Activa tu cuenta');
    expect(rendered.html).toContain('Crear mi contraseña');
  });

  it('escapes every variable to prevent HTML injection', () => {
    const dangerousVariables = {
      names: '<script>alert("xss")</script> Pedro & Juan',
      email: 'test+injection<@untrm.edu.pe',
      activationUrl: 'https://sigoa.untrm.edu.pe/activar/token?param="test"',
      expiresAt: '05/11/2026 <bold>',
      logoUrl: 'https://sigoa.untrm.edu.pe/logo.png?v="1"',
    };

    const rendered = accountActivationTemplate.render(dangerousVariables);

    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(rendered.html).toContain('Pedro &amp; Juan');
    expect(rendered.html).toContain('&quot;test&quot;');
  });

  it('provides a plain text alternative with the link and instructions', () => {
    const rendered = accountActivationTemplate.render(validVariables);

    expect(rendered.text).toContain(validVariables.activationUrl);
    expect(rendered.text).toContain(validVariables.names);
    expect(rendered.text).toContain(validVariables.email);
    expect(rendered.text).toContain(validVariables.expiresAt);
    expect(rendered.text).toContain(
      'Universidad Nacional Toribio Rodríguez de Mendoza de Amazonas',
    );
  });

  it('uses only colors declared in EMAIL_THEME', () => {
    const rendered = accountActivationTemplate.render(validVariables);

    // Encontrar todos los valores hexadecimales en el HTML (ej: #FFFFFF, #1d4570)
    const hexColorRegex = /#[0-9a-fA-F]{3,6}\b/g;
    const foundColors = (rendered.html.match(hexColorRegex) || []).map((c) => c.toUpperCase());

    const allowedColors = Object.values(EMAIL_THEME).map((c) => c.toUpperCase());

    for (const color of foundColors) {
      expect(allowedColors).toContain(color);
    }
  });

  it('contains no dni, password or role data', () => {
    const rendered = accountActivationTemplate.render(validVariables);
    const combinedContent = (rendered.html + rendered.text).toLowerCase();

    expect(combinedContent).not.toContain('dni');
    expect(combinedContent).not.toContain('password');
    expect(combinedContent).not.toContain('contraseña actual');
    expect(combinedContent).not.toContain('rol asignado');
  });

  it('rejects an invalid activation url or variables schema', () => {
    const invalidUrlVars = {
      ...validVariables,
      activationUrl: 'not-a-valid-url',
    };

    const parsed = accountActivationTemplate.variablesSchema.safeParse(invalidUrlVars);
    expect(parsed.success).toBe(false);
  });
});
