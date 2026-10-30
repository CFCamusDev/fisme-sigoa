import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { describe, it, expect } from 'vitest';
import { PuppeteerPdfGenerator } from './puppeteer-pdf-generator.js';
import { extractPdfFontNames } from './pdf-fonts.js';

const INTEGRATION_TEST_TIMEOUT_MS = 30_000;
const RENDER_BUDGET_MS = 10_000;
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
  it(
    'renders a valid PDF in less than 10 seconds using real Chromium',
    async () => {
      const executablePath = findChromiumExecutable();

      const generator = new PuppeteerPdfGenerator({
        executablePath,
        noSandbox: true,
        renderTimeoutMs: GENERATOR_RENDER_TIMEOUT_MS,
      });

      try {
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
        // RNF-021: El tiempo de renderizado de prueba debe ser < 10 segundos
        expect(elapsedMs).toBeLessThan(RENDER_BUDGET_MS);
      } finally {
        await generator.close();
      }
    },
    INTEGRATION_TEST_TIMEOUT_MS,
  );

  it(
    'reads the embedded font names from a real chromium pdf',
    async () => {
      const executablePath = findChromiumExecutable();

      const generator = new PuppeteerPdfGenerator({
        executablePath,
        noSandbox: true,
        renderTimeoutMs: GENERATOR_RENDER_TIMEOUT_MS,
      });

      try {
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
      } finally {
        await generator.close();
      }
    },
    INTEGRATION_TEST_TIMEOUT_MS,
  );
});
