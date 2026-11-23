import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { inflateSync } from 'node:zlib';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PuppeteerPdfGenerator } from './puppeteer-pdf-generator.js';
import { extractPdfFontNames } from './pdf-fonts.js';
import { withEmptyPdfHeader } from './pdf-options.js';

const COLD_START_LIMIT_MS = 45_000;
const COLD_START_TEST_TIMEOUT_MS = 60_000;
const RENDER_BUDGET_MS = 10_000;
const INTEGRATION_TEST_TIMEOUT_MS = 30_000;
const GENERATOR_RENDER_TIMEOUT_MS = 20_000;

function findChromiumExecutable(): string {
  if (
    process.env.PUPPETEER_EXECUTABLE_PATH &&
    fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)
  ) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidates: string[] = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'No se encontró ningún ejecutable de Chromium / Chrome / Edge en el sistema. Configure PUPPETEER_EXECUTABLE_PATH.',
  );
}

describe('PuppeteerPdfGenerator Integration (RNF-021, RS-063)', () => {
  let generator: PuppeteerPdfGenerator;

  beforeAll(() => {
    const executablePath = findChromiumExecutable();
    generator = new PuppeteerPdfGenerator({
      executablePath,
      noSandbox: true,
      renderTimeoutMs: GENERATOR_RENDER_TIMEOUT_MS,
    });
  });

  afterAll(async () => {
    if (generator) {
      await generator.close();
    }
  });

  it(
    'starts chromium within the cold start limit',
    async () => {
      const start = performance.now();
      await generator.warmUp();
      const elapsedMs = performance.now() - start;

      console.log(
        `[PDF Integration] Chromium cold start elapsed: ${elapsedMs.toFixed(2)} ms (limit: ${COLD_START_LIMIT_MS} ms)`,
      );
      expect(elapsedMs).toBeLessThan(COLD_START_LIMIT_MS);
    },
    COLD_START_TEST_TIMEOUT_MS,
  );

  it(
    'renders a valid PDF in less than 10 seconds using real Chromium',
    async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Reporte de Evaluación - FISME-SIGOA</title>
            <style>
              body { font-family: sans-serif; margin: 2rem; }
              h1 { color: #1e3a8a; }
              table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
              th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
              th { background-color: #f1f5f9; }
            </style>
          </head>
          <body>
            <h1>Programa de Estudios de Ingeniería de Sistemas (EPIS)</h1>
            <h2>Medición de Atributos del Graduado - ICACIT</h2>
            <p>Documento de verificación técnica del servicio de generación de PDF.</p>
            <table>
              <thead>
                <tr><th>Atributo</th><th>Nivel Logrado</th><th>Estado</th></tr>
              </thead>
              <tbody>
                <tr><td>AG-C01</td><td>Logrado</td><td>Aprobado</td></tr>
                <tr><td>AG-C02</td><td>En Proceso</td><td>En revisión</td></tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const start = performance.now();
      const pdfBuffer = await generator.render({
        html: testHtml,
        options: {
          format: 'A4',
          printBackground: true,
          margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
        },
      });
      const elapsedMs = performance.now() - start;

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(100);
      // Validación de cabecera estándar de archivo PDF (%PDF-)
      expect(pdfBuffer.toString('utf-8', 0, 5)).toContain('%PDF-');
      // RNF-021: El tiempo de renderizado con navegador ya iniciado debe ser < 10 segundos
      expect(elapsedMs).toBeLessThan(RENDER_BUDGET_MS);
    },
    INTEGRATION_TEST_TIMEOUT_MS,
  );

  it(
    'reads the embedded font names from a real chromium pdf',
    async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: 'Liberation Sans', sans-serif; }
            </style>
          </head>
          <body>
            <p>Prueba tipográfica de PDF con Chromium real.</p>
          </body>
        </html>
      `;

      const pdfBuffer = await generator.render({
        html: testHtml,
      });

      const fonts = extractPdfFontNames(pdfBuffer);
      expect(fonts.length).toBeGreaterThan(0);
    },
    INTEGRATION_TEST_TIMEOUT_MS,
  );

  it('does not print the browser header when withEmptyPdfHeader is applied', async () => {
    const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>TITULO-SOLO-NAVEGADOR</title>
          </head>
          <body>
            <p>Contenido oficial del anexo.</p>
          </body>
        </html>
      `;

    const pdfBuffer = await generator.render({
      html,
      options: withEmptyPdfHeader({
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: true,
        footerTemplate:
          '<div style="width:100%;font-size:8px;text-align:center;">Pie oficial</div>',
      }),
    });

    const latin1 = pdfBuffer.toString('latin1');
    const chunks: string[] = [];
    let cursor = 0;
    while (true) {
      const streamIdx = latin1.indexOf('stream', cursor);
      if (streamIdx === -1) break;
      const startOffset = latin1[streamIdx + 6] === '\r' ? streamIdx + 8 : streamIdx + 7;
      const endIdx = latin1.indexOf('endstream', startOffset);
      if (endIdx === -1) break;
      try {
        const inflated = inflateSync(pdfBuffer.subarray(startOffset, endIdx));
        chunks.push(inflated.toString('latin1'));
      } catch {
        // Streams no comprimidos o con otro filtro se ignoran.
      }
      cursor = endIdx + 9;
    }

    const extracted = chunks.join('\n');
    expect(extracted).not.toContain('TITULO-SOLO-NAVEGADOR');
    expect(extracted).not.toContain('about:blank');
  }, 20_000);
});
