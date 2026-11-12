import { z } from 'zod';
import { escapeHtml, type TemplateDefinition } from '../template-types.js';
import { EMAIL_THEME } from './account-activation.js';

export const passwordResetVariablesSchema = z.object({
  names: z.string().min(1),
  resetUrl: z.string().url(),
  expiresAt: z.string().min(1),
  logoUrl: z.string().url(),
});

export type PasswordResetVariables = z.infer<typeof passwordResetVariablesSchema>;

export const passwordResetTemplate: TemplateDefinition<PasswordResetVariables> = {
  version: 1,
  variablesSchema: passwordResetVariablesSchema,
  render: (vars) => {
    const names = escapeHtml(vars.names);
    const resetUrl = escapeHtml(vars.resetUrl);
    const expiresAt = escapeHtml(vars.expiresAt);
    const logoUrl = escapeHtml(vars.logoUrl);

    const html = `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Restablece tu contraseña de FISME-SIGOA</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_THEME.background};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Usa este enlace para crear una nueva contraseña.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_THEME.background};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${EMAIL_THEME.cardBg};border:1px solid ${EMAIL_THEME.border};border-radius:12px;overflow:hidden;font-family:'Segoe UI','Open Sans',Arial,Helvetica,sans-serif;">
    <tr><td bgcolor="${EMAIL_THEME.brandPrimary}" style="background:${EMAIL_THEME.brandPrimary};padding:18px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:14px;"><img src="${logoUrl}" width="48" height="48" alt="Universidad Nacional Toribio Rodríguez de Mendoza de Amazonas" style="display:block;border:0;width:48px;height:48px;"></td>
        <td style="font-family:'Segoe UI','Open Sans',Arial,Helvetica,sans-serif;color:${EMAIL_THEME.cardBg};">
          <div style="font-size:11px;line-height:16px;letter-spacing:1px;text-transform:uppercase;color:${EMAIL_THEME.brandLight};">EPIS · UNTRM</div>
          <div style="font-size:20px;line-height:26px;font-weight:700;color:${EMAIL_THEME.cardBg};">FISME-SIGOA</div>
        </td></tr></table>
    </td></tr>
    <tr><td style="padding:32px 28px 8px;font-family:'Segoe UI','Open Sans',Arial,Helvetica,sans-serif;">
      <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;font-weight:700;color:${EMAIL_THEME.textPrimary};">Restablece tu contraseña</h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${EMAIL_THEME.textPrimary};">Hola, ${names}:</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${EMAIL_THEME.textPrimary};">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr>
        <td bgcolor="${EMAIL_THEME.brandPrimary}" style="background:${EMAIL_THEME.brandPrimary};border-radius:8px;"><a href="${resetUrl}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:'Segoe UI','Open Sans',Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;font-weight:700;color:${EMAIL_THEME.cardBg};text-decoration:none;border-radius:8px;">Crear nueva contraseña</a></td>
      </tr></table>
      <p style="margin:0 0 6px;font-size:14px;line-height:20px;color:${EMAIL_THEME.textSecondary};">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:20px;word-break:break-all;"><a href="${resetUrl}" target="_blank" style="color:${EMAIL_THEME.link};text-decoration:underline;">${resetUrl}</a></p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr>
        <td style="background:${EMAIL_THEME.brandAccentBg};border-left:4px solid ${EMAIL_THEME.brandPrimary};border-radius:4px;padding:12px 16px;font-size:14px;line-height:20px;color:${EMAIL_THEME.textPrimary};"><strong>Este enlace es de un solo uso</strong> y vence el ${expiresAt}. Si tú no hiciste esta solicitud, ignora este correo: tu contraseña actual seguirá funcionando.</td></tr></table>
    </td></tr>
    <tr><td style="padding:20px 28px;background:${EMAIL_THEME.background};border-top:1px solid ${EMAIL_THEME.border};font-family:'Segoe UI','Open Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${EMAIL_THEME.textSecondary};">
      <strong style="color:${EMAIL_THEME.textPrimary};">Universidad Nacional Toribio Rodríguez de Mendoza de Amazonas</strong><br>
      Facultad de Ingeniería de Sistemas y Mecánica Eléctrica · Escuela Profesional de Ingeniería de Sistemas<br>
      Este mensaje se envió de forma automática desde FISME-SIGOA. Por favor, no respondas a este correo.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

    const text = `FISME-SIGOA — EPIS · UNTRM
Restablece tu contraseña

Hola, ${vars.names}:

Recibimos una solicitud para restablecer la contraseña de tu cuenta. Para crear una nueva, accede al siguiente enlace:

${vars.resetUrl}

Este enlace es de un solo uso y vence el ${vars.expiresAt}. Si tú no hiciste esta solicitud, ignora este correo: tu contraseña actual seguirá funcionando.

Universidad Nacional Toribio Rodríguez de Mendoza de Amazonas
Facultad de Ingeniería de Sistemas y Mecánica Eléctrica · Escuela Profesional de Ingeniería de Sistemas`;

    return { html, text };
  },
};
