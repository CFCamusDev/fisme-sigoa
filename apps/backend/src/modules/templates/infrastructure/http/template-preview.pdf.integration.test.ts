import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PuppeteerPdfGenerator } from '../../../../shared/pdf/puppeteer-pdf-generator.js';
import { PREVIEW_FOOTER_TEMPLATE } from '../../application/preview-template.js';
import { renderTemplateHtml } from '../../domain/policies/template-renderer.js';
import { buildTemplateSampleData } from '../../domain/policies/template-sample-data.js';
import { OFFICIAL_TEMPLATES } from '../prisma/seed/template-seed-data.js';

const WARMUP_TIMEOUT_MS = 60_000;
const RENDER_BUDGET_MS = 10_000;
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

describe('Template preview PDF integration (Chromium real, HU-019, T-019-10)', () => {
  let generator: PuppeteerPdfGenerator;

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

  it('renders every seeded template without leaving placeholders', () => {
    expect(OFFICIAL_TEMPLATES.length).toBeGreaterThanOrEqual(20);

    for (const template of OFFICIAL_TEMPLATES) {
      const sampleData = buildTemplateSampleData(template.content, template.variables);
      const rendered = renderTemplateHtml(template.content, sampleData);
      expect(rendered).not.toMatch(/\{\{[\s\S]*?\}\}/);
    }
  });

  it(
    'renders a seeded annex as a real pdf within the time budget',
    async () => {
      const annex = OFFICIAL_TEMPLATES.find((item) => item.code === 'FO-01');
      expect(annex).toBeDefined();

      const sampleData = buildTemplateSampleData(annex!.content, annex!.variables);
      const html = renderTemplateHtml(annex!.content, sampleData);

      const start = performance.now();
      const pdfBuffer = await generator.render({
        html,
        options: {
          format: 'A4',
          preferCSSPageSize: true,
          printBackground: true,
          displayHeaderFooter: true,
          footerTemplate: PREVIEW_FOOTER_TEMPLATE,
        },
      });
      const elapsedMs = performance.now() - start;

      expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      expect(elapsedMs).toBeLessThan(RENDER_BUDGET_MS);
    },
    INTEGRATION_TEST_TIMEOUT_MS,
  );

  it(
    'keeps the landscape page size of the schedule annex',
    async () => {
      const schedule = OFFICIAL_TEMPLATES.find((item) => item.code === 'FO-01');
      expect(schedule).toBeDefined();

      const sampleData = buildTemplateSampleData(schedule!.content, schedule!.variables);
      const html = renderTemplateHtml(schedule!.content, sampleData);

      const pdfBuffer = await generator.render({
        html,
        options: {
          format: 'A4',
          preferCSSPageSize: true,
          printBackground: true,
          displayHeaderFooter: true,
          footerTemplate: PREVIEW_FOOTER_TEMPLATE,
        },
      });

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
});
