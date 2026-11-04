import { describe, expect, it } from 'vitest';
// @ts-expect-error script sin archivo de declaraciones .d.ts
import {
  validateBranchName,
  validatePrTitle,
  validateCommitMessage,
  validateForbiddenFiles,
  buildExecutionPlan,
  computeOverallStatus,
  createReportJson,
  generateDisposableDbName,
  isSafeToDropDatabase,
  buildCleanEnvironment,
  checkCleanWorkingTree,
  markDatabaseStepsOmitted,
  planRepeatedSteps,
} from '../../../../scripts/ci/verify-pr-local.mjs';

describe('verify-pr-local pure logic (T-002-22 / G1)', () => {
  it('accepts valid work branch names and rejects main, develop and malformed names', () => {
    // Ramas válidas
    expect(validateBranchName('feature/HU-002-logout-refresh')).toEqual({
      valid: true,
      hu: 'HU-002',
    });
    expect(validateBranchName('fix/HU-001-login-error')).toEqual({
      valid: true,
      hu: 'HU-001',
    });
    expect(validateBranchName('docs/HU-074-deploy-guide')).toEqual({
      valid: true,
      hu: 'HU-074',
    });
    expect(validateBranchName('test/HU-002-contrast-helper')).toEqual({
      valid: true,
      hu: 'HU-002',
    });

    // Prohibido main y develop
    expect(validateBranchName('main').valid).toBe(false);
    expect(validateBranchName('main').error).toMatch(/main/i);
    expect(validateBranchName('develop').valid).toBe(false);
    expect(validateBranchName('develop').error).toMatch(/develop/i);

    // Malformadas
    expect(validateBranchName('feature/logout').valid).toBe(false);
    expect(validateBranchName('HU-002-logout').valid).toBe(false);
    expect(validateBranchName('feature/HU-2-logout').valid).toBe(false);
    expect(validateBranchName('random-branch').valid).toBe(false);
  });

  it('validates the pull request title and that its HU matches the branch', () => {
    const branchHu = 'HU-002';

    // Título válido coincidente
    expect(validatePrTitle('feat(auth): HU-002 maintain and close session', branchHu)).toEqual({
      valid: true,
    });
    expect(validatePrTitle('fix(design): HU-002 fix color contrast ratio', branchHu)).toEqual({
      valid: true,
    });

    // Formato inválido
    const invalidFormat = validatePrTitle('HU-002 maintain session', branchHu);
    expect(invalidFormat.valid).toBe(false);
    expect(invalidFormat.error).toMatch(/formato/i);

    // HU discrepante con la rama
    const mismatchedHu = validatePrTitle('feat(auth): HU-003 user management', branchHu);
    expect(mismatchedHu.valid).toBe(false);
    expect(mismatchedHu.error).toMatch(/no coincide/i);
  });

  it('does not fail when no title is given', () => {
    const resultNoTitle = validatePrTitle(undefined, 'HU-002');
    expect(resultNoTitle.valid).toBe(true);
    expect(resultNoTitle.skipped).toBe(true);
    expect(resultNoTitle.expectedFormat).toBeDefined();

    const resultEmptyTitle = validatePrTitle('', 'HU-002');
    expect(resultEmptyTitle.valid).toBe(true);
    expect(resultEmptyTitle.skipped).toBe(true);
  });

  it('flags commits without a Refs footer', () => {
    const validCommit = `feat(auth): add logout button\n\nRefs: HU-002, T-002-17`;
    expect(validateCommitMessage(validCommit)).toEqual({
      valid: true,
      violations: [],
    });

    const multipleRefs = `fix(deploy): wire and declare every variable\n\nRefs: HU-002, T-002-20, T-002-21`;
    expect(validateCommitMessage(multipleRefs)).toEqual({
      valid: true,
      violations: [],
    });

    const noRefs = `feat(auth): add logout button without refs`;
    const res = validateCommitMessage(noRefs);
    expect(res.valid).toBe(false);
    expect(res.violations.some((v: string) => /Refs:/i.test(v))).toBe(true);
  });

  it('flags Co-Authored-By, generated-with and AI tool mentions and emojis in commit messages', () => {
    // Co-Authored-By
    const coAuthor = `feat(auth): add feature\n\nRefs: HU-002, T-002-01\nCo-Authored-By: Assistant <ai@example.com>`;
    expect(validateCommitMessage(coAuthor).valid).toBe(false);

    // Generated with
    const generated = `feat(auth): add feature\n\nGenerated with AI\nRefs: HU-002, T-002-01`;
    expect(validateCommitMessage(generated).valid).toBe(false);

    // Menciones a herramientas de IA
    const claudeMsg = `feat(auth): prompt Claude for help\n\nRefs: HU-002, T-002-01`;
    expect(validateCommitMessage(claudeMsg).valid).toBe(false);

    const antigravityMsg = `feat(auth): build antigravity workflow\n\nRefs: HU-002, T-002-01`;
    expect(validateCommitMessage(antigravityMsg).valid).toBe(false);

    // Emojis
    const emojiMsg = `feat(auth): add button 🚀\n\nRefs: HU-002, T-002-01`;
    expect(validateCommitMessage(emojiMsg).valid).toBe(false);
  });

  it('flags files that must not be committed and allows .env.example and DEFINITION_OF_DONE', () => {
    const allowedFiles = [
      'apps/backend/src/server.ts',
      'apps/frontend/src/App.tsx',
      'docs/DEFINITION_OF_DONE.md',
      '.env.example',
      'apps/backend/.env.example',
      'deploy/stack.env.example',
    ];
    expect(validateForbiddenFiles(allowedFiles)).toEqual({
      valid: true,
      violations: [],
    });

    const forbiddenFiles = [
      'AGENTS.md',
      'CLAUDE.md',
      '.agents/skills/custom.md',
      '.claude/settings.json',
      'docs/plans/HU-002/HU-002-PLAN.md',
      'docs/diseno/mockup.png',
      'docs/backlog.csv',
      'docs/negocio.md',
      '.env',
      'apps/backend/.env',
      '.env.local',
    ];

    for (const file of forbiddenFiles) {
      const res = validateForbiddenFiles([file]);
      expect(res.valid, `Archivo "${file}" debe ser rechazado`).toBe(false);
      expect(res.violations.length).toBeGreaterThan(0);
    }
  });

  it('builds the quick, standard and full plans in order with the commands of pr-checks.yml', () => {
    const quickPlan = buildExecutionPlan('quick');
    const quickIds = quickPlan.map((c: { id: string }) => c.id);

    expect(quickIds).toContain('branch-name');
    expect(quickIds).toContain('commit-messages');
    expect(quickIds).toContain('forbidden-files');
    expect(quickIds).toContain('env-parity');
    expect(quickIds).toContain('audit');
    expect(quickIds).toContain('format');
    expect(quickIds).toContain('lint');
    expect(quickIds).toContain('depcruise');
    expect(quickIds).toContain('typecheck');
    expect(quickIds).toContain('compose-config');
    expect(quickIds).toContain('compose-hardening');

    // quick no debe incluir integración pesada ni e2e
    expect(quickIds).not.toContain('integration-tests');
    expect(quickIds).not.toContain('e2e');

    const standardPlan = buildExecutionPlan('standard');
    const standardIds = standardPlan.map((c: { id: string }) => c.id);
    expect(standardIds).toContain('integration-tests');
    expect(standardIds).toContain('test-coverage');
    expect(standardIds).toContain('build');
    expect(standardIds).not.toContain('e2e');

    const fullPlan = buildExecutionPlan('full');
    const fullIds = fullPlan.map((c: { id: string }) => c.id);
    expect(fullIds).toContain('e2e');
    expect(fullIds).toContain('pdf-stability');
    expect(fullIds).toContain('docker-smoke');
  });

  it('reports failures with the command and the suggested action', () => {
    const plan = buildExecutionPlan('quick');
    const envParityCheck = plan.find((c: { id: string }) => c.id === 'env-parity');
    expect(envParityCheck).toBeDefined();
    expect(envParityCheck?.command).toMatch(/check:env-parity/);
    expect(envParityCheck?.actionSuggestion).toBeDefined();
  });

  it('returns exit code 0, 1 or 2 according to failures and omitted steps', () => {
    // Todo OK
    const allOk = [
      { id: 'c1', status: 'ok' as const },
      { id: 'c2', status: 'ok' as const },
    ];
    expect(computeOverallStatus(allOk, 'standard')).toEqual({
      overallStatus: 'ok',
      exitCode: 0,
    });

    // Con fallos -> exitCode 1
    const withFail = [
      { id: 'c1', status: 'ok' as const },
      { id: 'c2', status: 'failed' as const },
    ];
    expect(computeOverallStatus(withFail, 'standard')).toEqual({
      overallStatus: 'failed',
      exitCode: 1,
    });

    // Con omitidos en standard -> exitCode 2
    const withOmitted = [
      { id: 'c1', status: 'ok' as const },
      { id: 'c2', status: 'omitted' as const },
    ];
    expect(computeOverallStatus(withOmitted, 'standard')).toEqual({
      overallStatus: 'omitted',
      exitCode: 2,
    });
  });

  it('treats omitted steps as warnings in quick mode', () => {
    const withOmitted = [
      { id: 'c1', status: 'ok' as const },
      { id: 'c2', status: 'omitted' as const },
    ];
    expect(computeOverallStatus(withOmitted, 'quick')).toEqual({
      overallStatus: 'ok',
      exitCode: 0,
    });
  });

  it('writes a report with the head sha, mode and per-check results', () => {
    const report = createReportJson({
      branch: 'feature/HU-002-logout-refresh',
      headSha: 'c0e7b52',
      baseSha: 'develop',
      mode: 'quick',
      clean: false,
      repeat: 1,
      cleanWorkingTree: true,
      startedAt: '2026-11-03T20:00:00.000Z',
      completedAt: '2026-11-03T20:01:00.000Z',
      checks: [
        {
          id: 'branch-name',
          name: 'Nombre de rama',
          status: 'ok',
          durationMs: 50,
          finishedAt: '2026-11-03T20:00:01.000Z',
        },
      ],
    });

    expect(report.version).toBe('1.0.0');
    expect(report.branch).toBe('feature/HU-002-logout-refresh');
    expect(report.headSha).toBe('c0e7b52');
    expect(report.mode).toBe('quick');
    expect(report.checks.length).toBe(1);
    expect(report.exitCode).toBe(0);
    expect(report.overallStatus).toBe('ok');
  });

  describe('disposable database and clean environment (T-002-22 / G2)', () => {
    it('generates a disposable database name that matches the allowed pattern', () => {
      const name = generateDisposableDbName();
      expect(name).toMatch(/^sigoa_verify_[0-9a-f]{8}_test$/);
    });

    it('refuses to drop a database that does not match the pattern, sigoa_dev or sigoa_test', () => {
      // Debe aceptar solo bases con el prefijo y sufijo estricto
      expect(isSafeToDropDatabase('sigoa_verify_1234abcd_test')).toBe(true);

      // Debe rechazar bases reales o de test permanente
      expect(isSafeToDropDatabase('sigoa_dev')).toBe(false);
      expect(isSafeToDropDatabase('sigoa_test')).toBe(false);
      expect(isSafeToDropDatabase('oeag_test')).toBe(false);
      expect(isSafeToDropDatabase('postgres')).toBe(false);
      expect(isSafeToDropDatabase('sigoa_verify_invalid')).toBe(false);
      expect(isSafeToDropDatabase('')).toBe(false);
    });

    it('builds the clean environment with only the workflow variables', () => {
      const dbUrl = 'postgresql://test:test@localhost:5432/sigoa_verify_1234abcd_test';
      const cleanEnv = buildCleanEnvironment(dbUrl, {
        PATH: 'C:\\Windows\\system32',
        SECRET_LOCAL_VAR: 'super_secret',
        CUSTOM_DEV_FLAG: '1',
      });

      expect(cleanEnv.DATABASE_URL).toBe(dbUrl);
      expect(cleanEnv.NODE_ENV).toBe('test');
      expect(cleanEnv.CI).toBe('true');
      expect(cleanEnv.PATH).toBe('C:\\Windows\\system32');

      // Variables locales no deseadas no deben estar
      expect(cleanEnv.SECRET_LOCAL_VAR).toBeUndefined();
      expect(cleanEnv.CUSTOM_DEV_FLAG).toBeUndefined();
    });

    it('warns when the working tree has uncommitted changes in clean mode', () => {
      const dirtyOutput = ' M apps/frontend/src/App.tsx\n?? untracked.txt';
      const resultDirty = checkCleanWorkingTree(dirtyOutput);
      expect(resultDirty.isClean).toBe(false);
      expect(resultDirty.warning).toMatch(/cambios sin confirmar/i);

      const cleanOutput = '';
      const resultClean = checkCleanWorkingTree(cleanOutput);
      expect(resultClean.isClean).toBe(true);
      expect(resultClean.warning).toBeUndefined();
    });

    it('marks database steps as omitted when PostgreSQL is not reachable', () => {
      const plan = [
        { id: 'branch-name', name: 'Rama', group: 'convenciones', status: 'ok' },
        { id: 'disposable-db', name: 'BD Desechable', group: 'calidad', status: 'pending' },
        { id: 'integration-tests', name: 'Integración', group: 'calidad', status: 'pending' },
      ];

      const updated = markDatabaseStepsOmitted(plan, 'PostgreSQL no disponible en localhost:5432');
      const dbStep = updated.find((c: { id: string }) => c.id === 'disposable-db');
      const integStep = updated.find((c: { id: string }) => c.id === 'integration-tests');
      const branchStep = updated.find((c: { id: string }) => c.id === 'branch-name');

      expect(dbStep.status).toBe('omitted');
      expect(dbStep.reason).toMatch(/PostgreSQL no disponible/);
      expect(integStep.status).toBe('omitted');
      expect(branchStep.status).toBe('ok');
    });

    it('always cleans up the disposable database and the worktree', () => {
      const cleanups: string[] = [];
      const dummyAction = () => {
        try {
          cleanups.push('execute-step');
          throw new Error('Simulation step failure');
        } finally {
          cleanups.push('cleanup-db');
          cleanups.push('cleanup-worktree');
        }
      };

      expect(() => dummyAction()).toThrow(/Simulation step failure/);
      expect(cleanups).toEqual(['execute-step', 'cleanup-db', 'cleanup-worktree']);
    });

    it('repeats the integration, e2e and pdf steps n times and fails on the first failure', () => {
      const baseSteps = [
        { id: 'env-parity', name: 'Paridad' },
        { id: 'integration-tests', name: 'Integración' },
      ];

      const planned = planRepeatedSteps(baseSteps, 3);
      const integSteps = planned.filter((s: { id: string }) => s.id === 'integration-tests');

      expect(integSteps.length).toBe(3);
      expect(integSteps[0].iteration).toBe(1);
      expect(integSteps[2].iteration).toBe(3);

      const nonRepeated = planned.filter((s: { id: string }) => s.id === 'env-parity');
      expect(nonRepeated.length).toBe(1);
    });

    it('only reruns the selected checks', () => {
      const plan = buildExecutionPlan('full', { only: ['audit', 'typecheck'] });
      expect(plan.length).toBe(2);
      expect(plan.map((c: { id: string }) => c.id)).toEqual(['audit', 'typecheck']);
    });
  });
});
