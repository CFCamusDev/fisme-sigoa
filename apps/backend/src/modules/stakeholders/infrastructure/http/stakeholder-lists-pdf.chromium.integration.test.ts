import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PuppeteerPdfGenerator } from '../../../../shared/pdf/puppeteer-pdf-generator.js';
import {
  buildAnnexPdfFooter,
  buildOfficialRenderData,
  InstitutionalAnnexDataProvider,
  OFFICIAL_TEMPLATES,
  renderTemplateHtml,
} from '../../../templates/index.js';
import { StakeholderList } from '../../domain/entities/stakeholder-list.js';
import type { StakeholderListType } from '../../domain/entities/stakeholder-list-enums.js';
import { StakeholderListMember } from '../../domain/entities/stakeholder-list-member.js';
import { buildAnnex3RenderData } from '../../domain/policies/build-annex3-render-data.js';

const WARMUP_TIMEOUT_MS = 60_000;
const RENDER_BUDGET_MS = 10_000;

function findChromiumExecutable(): string {
  if (
    process.env.PUPPETEER_EXECUTABLE_PATH &&
    fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)
  ) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidates = [
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

describe('Stakeholder list Annex 3 PDF (Chromium real, HU-026, T-026-08)', () => {
  let generator: PuppeteerPdfGenerator;
  const provider = new InstitutionalAnnexDataProvider();
  const generatedAt = new Date('2026-11-20T15:00:00.000Z');

  beforeAll(async () => {
    generator = new PuppeteerPdfGenerator({
      executablePath: findChromiumExecutable(),
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

  it(
    'renders a real pdf of a large list within the time budget',
    async () => {
      const fo03 = OFFICIAL_TEMPLATES.find((item) => item.code === 'FO-03');
      expect(fo03).toBeDefined();

      const types: readonly StakeholderListType[] = [
        'ADVISORY_BOARD',
        'EMPLOYER',
        'GRADUATE',
        'STUDENT',
        'TEACHER',
      ];
      const lists = types.map((type, typeIdx) => {
        const list = StakeholderList.reconstitute({
          id: `list-${typeIdx}`,
          programId: 'prog-1',
          type,
          year: 2026,
          studyPlanNumber: '2024',
          version: 'v1.0',
          createdBy: 'seed',
          createdAt: generatedAt,
          updatedAt: generatedAt,
        });
        const members = Array.from({ length: 120 }, (_, i) =>
          StakeholderListMember.reconstitute({
            id: `mem-${typeIdx}-${i}`,
            listId: list.id,
            stakeholderId: `stk-${typeIdx}-${i}`,
            fullName: `Constituyente Ficticio ${typeIdx}-${i}`,
            institution: `Institución ${i}`,
            ruc: '20123456789',
            sector: 'Tecnología',
            representative: `Representante ${i}`,
            activity: `Actividad ${i}`,
            email: `persona${i}@ejemplo.test`,
            mobile: '999000111',
            position: 'Especialista',
            graduationYear: 2022,
            cycle: 'VIII',
            createdBy: 'seed',
            createdAt: generatedAt,
          }),
        );
        return { list, members };
      });

      const provided = await provider.provide({ annexCode: 'FO-03', generatedAt });
      const annex3Data = buildAnnex3RenderData(lists[0]!.list, lists);
      const renderData = buildOfficialRenderData(
        fo03!.variables,
        {
          scalars: { ...(provided.scalars ?? {}), ...annex3Data.scalars },
          collections: { ...(provided.collections ?? {}), ...annex3Data.collections },
        },
        fo03!.content,
      );

      const html = renderTemplateHtml(fo03!.content, renderData);
      expect(html).not.toMatch(/\{\{[^}]+\}\}/);

      const footerTemplate = buildAnnexPdfFooter({
        templateCode: 'FO-03',
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

      expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      expect(elapsedMs).toBeLessThan(RENDER_BUDGET_MS);
    },
    RENDER_BUDGET_MS,
  );
});
