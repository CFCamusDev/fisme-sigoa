import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRootDir = path.resolve(__dirname, '..');
const e2eDir = path.resolve(frontendRootDir, 'e2e');

describe('E2E Test Hygiene and Explicit Timeouts (Frontend)', () => {
  it('ensures e2e specs have no waitForTimeout, skip or only calls', () => {
    const files = fs.readdirSync(e2eDir).filter((f) => f.endsWith('.spec.ts'));
    expect(files.length).toBeGreaterThan(0);

    const violations: { file: string; rule: string; line: number }[] = [];

    for (const file of files) {
      const fullPath = path.join(e2eDir, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split(/\r?\n/);

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          return;
        }

        if (/\bwaitForTimeout\s*\(/.test(line)) {
          violations.push({ file, rule: 'waitForTimeout()', line: index + 1 });
        }
        if (/\.skip\s*\(/.test(line)) {
          violations.push({ file, rule: '.skip', line: index + 1 });
        }
        if (/\.only\s*\(/.test(line)) {
          violations.push({ file, rule: '.only', line: index + 1 });
        }
      });
    }

    expect(
      violations,
      `Se encontraron violaciones de higiene en especificaciones E2E:\n${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });

  it('ensures playwright.config.ts declares explicit timeouts for tests, assertions and actions', () => {
    const configFile = path.resolve(frontendRootDir, 'playwright.config.ts');
    const content = fs.readFileSync(configFile, 'utf-8');

    // timeout por prueba (30s)
    expect(content).toMatch(/timeout:\s*30_?000/);
    // expect.timeout (10s)
    expect(content).toMatch(/expect:\s*\{\s*timeout:\s*10_?000,?\s*\}/);
    // use.actionTimeout (10s)
    expect(content).toMatch(/actionTimeout:\s*10_?000/);
    // use.navigationTimeout (15s)
    expect(content).toMatch(/navigationTimeout:\s*15_?000/);
    // globalTimeout en CI (15m = 900_000 o 15 * 60 * 1000)
    expect(content).toMatch(/globalTimeout:\s*(?:15\s*\*\s*60\s*\*\s*1000|900_?000)/);
  });
});

/**
 * Contextos de `expectNoContrastViolations` de `contrast.spec.ts`, capturados antes de agrupar las
 * pruebas por ruta (HU-078, T-078-19, RNF-036). Agrupar no puede perder ninguna ruta ni viewport.
 */
const EXPECTED_CONTRAST_CONTEXTS = [
  'catalog-versions-empty-desktop',
  'catalog-versions-with-open-desktop',
  'catalog-versions-with-open-mobile',
  'catalog-versions-readonly-desktop',
  'catalog-editor-draft-desktop',
  'catalog-editor-history-desktop',
  'catalog-history-compare-desktop',
  'catalog-history-compare-mobile',
  'catalog-history-empty-desktop',
  'catalog-editor-draft-mobile',
  'catalog-editor-readonly-desktop',
  'catalog-editor-readonly-mobile',
  'authenticated-layout-desktop',
  'authenticated-layout-mobile-menu-open',
  'sidebar-group-and-user-menu-open',
  'create-role-empty-desktop',
  'create-role-empty-mobile',
  'create-role-with-errors',
  'create-user-empty-desktop',
  'create-user-empty-mobile',
  'create-user-with-errors',
  'edit-role-form',
  'edit-user-form',
  'login-credentials-error',
  'login-desktop',
  'login-mobile',
  'login-session-expired',
  'parameters-page-history-desktop',
  'parameters-page-mobile',
  'parameters-page-readonly-desktop',
  'parameters-page-weights-error-desktop',
  'program-config-editable-desktop',
  'program-config-editable-mobile',
  'program-config-readonly-desktop',
  'resolutions-approved-desktop',
  'resolutions-approved-mobile',
  'resolutions-empty-desktop',
  'resolutions-readonly-desktop',
  'resolutions-readonly-mobile',
  'resolutions-registered-approval-desktop',
  'resolutions-registered-approval-mobile',
  'role-permissions-matrix-desktop',
  'role-permissions-matrix-mobile',
  'response-scales-create-form-error-desktop',
  'response-scales-duplicate-panel-desktop',
  'response-scales-page-desktop',
  'response-scales-page-mobile',
  'response-scales-readonly-desktop',
  'role-permissions-unsaved-changes',
  'roles-deactivation-alertdialog',
  'roles-list-desktop',
  'roles-list-mobile',
  'semesters-page-desktop',
  'semesters-page-mobile',
  'semesters-page-readonly-desktop',
  'semesters-page-with-data-desktop',
  'templates-confirm-desktop',
  'templates-confirm-mobile',
  'templates-editor-desktop',
  'templates-editor-mobile',
  'templates-list-desktop',
  'templates-list-mobile',
  'templates-readonly-desktop',
  'templates-readonly-mobile',
  'templates-variables-desktop',
  'user-access-panel-desktop',
  'user-access-panel-mobile',
  'user-access-panel-unsaved-changes',
  'users-deactivation-confirmation',
  'users-list-desktop',
  'users-list-empty-filtered',
  'users-list-mobile',
];

const CONTRAST_SPEC_FILES = [
  'contrast.spec.ts',
  'contrast-users.spec.ts',
  'contrast-roles.spec.ts',
  'contrast-settings.spec.ts',
  'contrast-catalog.spec.ts',
  'contrast-resolutions.spec.ts',
  'contrast-templates.spec.ts',
];

describe('Contrast coverage is preserved when grouping by route (T-078-19, T-080-06, D12)', () => {
  const sources = CONTRAST_SPEC_FILES.map((file) => ({
    file,
    content: fs.readFileSync(path.join(e2eDir, file), 'utf-8'),
  }));
  const combinedSource = sources.map((entry) => entry.content).join('\n');
  const supportContrastSource = fs.readFileSync(
    path.join(e2eDir, 'support', 'contrast.ts'),
    'utf-8',
  );
  const contexts = [...combinedSource.matchAll(/context:\s*'([^']+)'/g)].map((match) => match[1]);

  it('keeps every contrast context across the contrast specs, each checked exactly once', () => {
    expect(new Set(contexts).size).toBe(contexts.length);
    expect([...contexts].sort()).toEqual([...EXPECTED_CONTRAST_CONTEXTS].sort());
  });

  it('keeps one contrast check per context, not only the label', () => {
    const calls = [
      ...combinedSource.matchAll(/expectNoContrastViolations\(\s*page,\s*\{\s*context:/g),
    ];
    expect(calls).toHaveLength(EXPECTED_CONTRAST_CONTEXTS.length);
  });

  it('sets a mobile viewport before every mobile context and the desktop viewport otherwise', () => {
    expect(supportContrastSource).toMatch(/export const MOBILE = \{ width: 375, height: 812 \}/);
    expect(supportContrastSource).toMatch(/export const DESKTOP = \{ width: 1280, height: 720 \}/);

    for (const context of EXPECTED_CONTRAST_CONTEXTS.filter((name) => name.includes('mobile'))) {
      const owner = sources.find((entry) => entry.content.includes(`context: '${context}'`));
      expect(owner, `${context} debe existir en uno de los specs de contraste`).toBeDefined();
      const content = owner!.content;
      const position = content.indexOf(`context: '${context}'`);
      const before = content.slice(Math.max(0, position - 400), position);
      expect(before, `${context} debe estar precedido por el viewport móvil`).toMatch(
        /setViewportSize\(MOBILE\)/,
      );
    }
  });

  it('logs in at most once per route group', () => {
    const logins = combinedSource.match(/loginAsTestUser\(/g) ?? [];
    const tests = combinedSource.match(/^\s{2}test\('/gm) ?? [];
    expect(logins.length).toBeLessThanOrEqual(tests.length);
    expect(tests.length).toBeLessThan(25);
  });
});
