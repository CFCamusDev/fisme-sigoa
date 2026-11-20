import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { ANNEX_CODES } from '@sigoa/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OFFICIAL_LOGO_DATA_URI } from '../../../../shared/branding/official-logo-data-uri.js';
import { PuppeteerPdfGenerator } from '../../../../shared/pdf/puppeteer-pdf-generator.js';
import { buildAnnexPdfFooter } from '../../application/annex-pdf-footer.js';
import { buildOfficialRenderData } from '../../domain/policies/official-render-data.js';
import { renderTemplateHtml } from '../../domain/policies/template-renderer.js';
import { OFFICIAL_TEMPLATES } from '../prisma/seed/template-seed-data.js';
import { InstitutionalAnnexDataProvider } from '../rendering/institutional-annex-data-provider.js';

const WARMUP_TIMEOUT_MS = 60_000;
const RENDER_BUDGET_MS = 10_000;
const BATCH_TEST_TIMEOUT_MS = 60_000;
const INTEGRATION_TEST_TIMEOUT_MS = 30_000;

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

describe('Official annex PDF integration (Chromium real, HU-070, T-070-10)', () => {
  let generator: PuppeteerPdfGenerator;
  const provider = new InstitutionalAnnexDataProvider();
  const generatedAt = new Date('2026-11-20T15:00:00.000Z');

  beforeAll(async () => {
    const executablePath = findChromiumExecutable();
    generator = new PuppeteerPdfGenerator({
      executablePath,
      noSandbox: true,
      renderTimeoutMs: 20_000,
    });
    await generator.warmUp();
  }, WARMUP_TIMEOUT_MS);

  afterAll(async () => {
    if (generator) {
      await generator.close();
    }
  });

  async function renderOfficialAnnex(code: string) {
    const annex = OFFICIAL_TEMPLATES.find((item) => item.code === code && item.type === 'ANNEX');
    expect(annex).toBeDefined();

    const provided = await provider.provide({ annexCode: code, generatedAt });
    const data = buildOfficialRenderData(annex!.variables, provided, annex!.content);
    const html = renderTemplateHtml(annex!.content, data);

    expect(html).not.toMatch(/\{\{[^}]+\}\}/);

    const footerTemplate = buildAnnexPdfFooter({
      templateCode: code,
      versionNumber: 1,
      generatedAt,
    });

    const start = performance.now();
    const pdfBuffer = await generator.render({
      html,
      options: {
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: true,
        footerTemplate,
      },
    });
    const elapsedMs = performance.now() - start;

    return { html, pdfBuffer, elapsedMs };
  }

  it(
    'renders the 11 official annexes as real pdfs within the time budget',
    async () => {
      for (const code of ANNEX_CODES) {
        const { pdfBuffer, elapsedMs } = await renderOfficialAnnex(code);
        expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
        expect(elapsedMs).toBeLessThan(RENDER_BUDGET_MS);
      }
    },
    BATCH_TEST_TIMEOUT_MS,
  );

  it(
    'keeps the landscape page size of the schedule annex',
    async () => {
      const { pdfBuffer } = await renderOfficialAnnex('FO-01');
      const pdfText = pdfBuffer.toString('latin1');
      const mediaBoxMatch = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(
        pdfText,
      );
      expect(mediaBoxMatch).not.toBeNull();
      const width = Number(mediaBoxMatch![3]) - Number(mediaBoxMatch![1]);
      const height = Number(mediaBoxMatch![4]) - Number(mediaBoxMatch![2]);
      expect(width).toBeGreaterThan(height);
    },
    INTEGRATION_TEST_TIMEOUT_MS,
  );

  it(
    'embeds the official logo',
    async () => {
      const { html, pdfBuffer } = await renderOfficialAnnex('FO-01');
      expect(html).toContain(OFFICIAL_LOGO_DATA_URI);
      expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      expect(pdfBuffer.byteLength).toBeGreaterThan(10_000);
    },
    INTEGRATION_TEST_TIMEOUT_MS,
  );
});
