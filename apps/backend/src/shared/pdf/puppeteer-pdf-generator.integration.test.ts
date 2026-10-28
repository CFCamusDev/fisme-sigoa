import fs from 'node:fs';
import { describe, it, expect, afterAll } from 'vitest';
import { PuppeteerPdfGenerator } from './puppeteer-pdf-generator.js';

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
  let generator: PuppeteerPdfGenerator | undefined;

  afterAll(async () => {
    if (generator) {
      await generator.close();
    }
  });

  it('renders a valid PDF in less than 10 seconds using real Chromium', async () => {
    const executablePath = findChromiumExecutable();

    generator = new PuppeteerPdfGenerator({
      executablePath,
      noSandbox: true,
      renderTimeoutMs: 10000,
    });

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

    const start = Date.now();
    const pdfBuffer = await generator.render({
      html: testHtml,
      options: {
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      },
    });
    const elapsedMs = Date.now() - start;

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(100);
    // Validación de cabecera estándar de archivo PDF (%PDF-)
    expect(pdfBuffer.toString('utf-8', 0, 5)).toContain('%PDF-');
    // RNF-021: El tiempo de renderizado de prueba debe ser < 10 segundos
    expect(elapsedMs).toBeLessThan(10000);
  });
});
