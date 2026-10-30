/**
 * Verificación en contenedor Docker de que Chromium genera PDFs usando la tipografía Open Sans.
 * Se ejecuta dentro del contenedor de backend con restricciones de producción (sandbox activo,
 * usuario no root, solo lectura, tmpfs en /tmp).
 * Tiempo máximo explícito: 60 segundos.
 */
import { PuppeteerPdfGenerator, extractPdfFontNames } from './dist/shared/pdf/index.js';

const TIMEOUT_MS = 60_000;
const timeoutId = setTimeout(() => {
  console.error(`ERROR: verify-pdf-font excedió el tiempo límite de ${TIMEOUT_MS / 1000}s`);
  process.exit(1);
}, TIMEOUT_MS);

timeoutId.unref();

async function main() {
  console.log('==> Iniciando verificación de fuente Open Sans en el PDF generado por Chromium...');
  const generator = new PuppeteerPdfGenerator({
    // En el contenedor endurecido, Chromium corre con sandbox activo por defecto
    noSandbox: process.env.PDF_CHROMIUM_NO_SANDBOX === 'true',
    renderTimeoutMs: 30_000,
  });

  try {
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Open Sans', sans-serif;
      font-size: 14px;
      color: #1a202c;
    }
  </style>
</head>
<body>
  <h1>FISME-SIGOA — Verificación de Tipografía Institucional</h1>
  <p>Este documento valida que Open Sans está disponible y embebida en el PDF generado por Chromium.</p>
</body>
</html>`;

    console.log('==> Renderizando PDF de prueba...');
    const pdfBuffer = await generator.renderHtml(html);
    console.log(`==> PDF renderizado exitosamente (${pdfBuffer.length} bytes).`);

    const fontNames = extractPdfFontNames(pdfBuffer);
    console.log(`==> Fuentes detectadas en el PDF: ${JSON.stringify(fontNames)}`);

    const hasOpenSans = fontNames.some((font) =>
      font.toLowerCase().replace(/[\s-_]/g, '').includes('opensans')
    );

    if (!hasOpenSans) {
      console.error(
        `ERROR: No se encontró la fuente Open Sans en el PDF generado. Fuentes detectadas: ${fontNames.join(', ') || '(ninguna)'}`
      );
      process.exit(1);
    }

    console.log('✓ Fuente Open Sans verificada exitosamente en el PDF generado por Chromium.');
    process.exit(0);
  } finally {
    await generator.close();
  }
}

main().catch((err) => {
  console.error('ERROR inesperado durante la verificación de fuente en PDF:', err);
  process.exit(1);
});
