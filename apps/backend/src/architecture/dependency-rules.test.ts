import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { cruise } from 'dependency-cruiser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Carga la configuración real de dependency-cruiser del backend
const config = require('../../.dependency-cruiser.cjs');

interface Violation {
  rule: {
    name: string;
    severity: string;
  };
  from: string;
  to: string;
}

interface CruiseOutput {
  summary: {
    violations: Violation[];
    error: number;
    warn: number;
    info: number;
    totalCruised: number;
  };
}

async function runCruiseOnFixture(fixtureName: string): Promise<CruiseOutput> {
  const fixtureDir = path.resolve(__dirname, '../../test-fixtures/architecture', fixtureName);
  const cruiseResult = await cruise(['src'], {
    ...config.options,
    baseDir: fixtureDir,
    validate: true,
    ruleSet: { forbidden: config.forbidden },
    outputType: 'json',
  });

  return JSON.parse(cruiseResult.output as string) as CruiseOutput;
}

describe('dependency-cruiser hexagonal rules (RNF-026)', { timeout: 30_000 }, () => {
  it('accepts a module that respects the hexagonal layers', async () => {
    const output = await runCruiseOnFixture('valid-module');
    expect(output.summary.error).toBe(0);
    expect(output.summary.violations).toHaveLength(0);
  });

  it('fails when domain imports express', async () => {
    const output = await runCruiseOnFixture('domain-imports-express');
    expect(output.summary.error).toBeGreaterThan(0);
    const hasRuleViolation = output.summary.violations.some(
      (v) => v.rule.name === 'domain-no-infrastructure-libs' || v.rule.name === 'domain-allowlist',
    );
    expect(hasRuleViolation).toBe(true);
  });

  it('fails when domain imports prisma', async () => {
    const output = await runCruiseOnFixture('domain-imports-prisma');
    expect(output.summary.error).toBeGreaterThan(0);
    const hasRuleViolation = output.summary.violations.some(
      (v) =>
        v.rule.name === 'domain-no-infrastructure-libs' ||
        v.rule.name === 'prisma-only-in-infrastructure' ||
        v.rule.name === 'domain-allowlist',
    );
    expect(hasRuleViolation).toBe(true);
  });

  it('fails when domain imports infrastructure', async () => {
    const output = await runCruiseOnFixture('domain-imports-infra');
    expect(output.summary.error).toBeGreaterThan(0);
    const hasRuleViolation = output.summary.violations.some(
      (v) => v.rule.name === 'domain-no-other-layers' || v.rule.name === 'domain-allowlist',
    );
    expect(hasRuleViolation).toBe(true);
  });

  it('fails when application imports infrastructure', async () => {
    const output = await runCruiseOnFixture('app-imports-infra');
    expect(output.summary.error).toBeGreaterThan(0);
    const hasRuleViolation = output.summary.violations.some(
      (v) => v.rule.name === 'application-no-infrastructure',
    );
    expect(hasRuleViolation).toBe(true);
  });

  it('fails when a module imports another module', async () => {
    const output = await runCruiseOnFixture('cross-module');
    expect(output.summary.error).toBeGreaterThan(0);
    const hasRuleViolation = output.summary.violations.some(
      (v) => v.rule.name === 'module-isolation',
    );
    expect(hasRuleViolation).toBe(true);
  });

  it('fails when shared imports a module', async () => {
    const output = await runCruiseOnFixture('shared-imports-module');
    expect(output.summary.error).toBeGreaterThan(0);
    const hasRuleViolation = output.summary.violations.some(
      (v) => v.rule.name === 'shared-no-modules',
    );
    expect(hasRuleViolation).toBe(true);
  });

  it('fails when a circular dependency exists', async () => {
    const output = await runCruiseOnFixture('circular');
    expect(output.summary.error).toBeGreaterThan(0);
    const hasRuleViolation = output.summary.violations.some((v) => v.rule.name === 'no-circular');
    expect(hasRuleViolation).toBe(true);
  });

  it('allows domain to import shared errors', async () => {
    const output = await runCruiseOnFixture('domain-allows-shared-errors');
    expect(output.summary.error).toBe(0);
    expect(output.summary.violations).toHaveLength(0);
  });

  it('fails when a unit test uses the database (RNF-030)', async () => {
    const output = await runCruiseOnFixture('unit-test-uses-database');
    expect(output.summary.error).toBeGreaterThan(0);
    const hasRuleViolation = output.summary.violations.some(
      (v) => v.rule.name === 'unit-tests-no-database',
    );
    expect(hasRuleViolation).toBe(true);
  });

  it('allows an integration test to use the database (RNF-030)', async () => {
    const output = await runCruiseOnFixture('integration-test-uses-database');
    expect(output.summary.error).toBe(0);
    expect(output.summary.violations).toHaveLength(0);
  });

  it('fails when application code imports a provider SDK (RNF-033)', async () => {
    const output = await runCruiseOnFixture('app-imports-provider-sdk');
    expect(output.summary.error).toBeGreaterThan(0);
    const hasRuleViolation = output.summary.violations.some(
      (v) => v.rule.name === 'provider-sdks-only-in-adapters',
    );
    expect(hasRuleViolation).toBe(true);
  });

  it('allows a provider SDK inside a shared adapter (RNF-033)', async () => {
    const output = await runCruiseOnFixture('adapter-imports-provider-sdk');
    expect(output.summary.error).toBe(0);
    expect(output.summary.violations).toHaveLength(0);
  });
});
