import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../../');
const workflowPath = path.join(repoRoot, '.github', 'workflows', 'pr-checks.yml');

function extractJobBlock(content: string, jobId: string): string {
  const lines = content.split(/\r?\n/);
  const startIdx = lines.findIndex((line) => new RegExp(`^  ${jobId}:\\s*$`).test(line));
  if (startIdx === -1) return '';
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    if (/^ {2}[a-z0-9-]+:\s*$/.test(lines[i] ?? '')) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join('\n');
}

describe('pr-checks.yml structure (HU-080)', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  it('declares env per job so the env parity rule can read it', () => {
    for (const jobId of ['estaticas', 'unitarias', 'integracion', 'e2e-shards']) {
      const block = extractJobBlock(workflow, jobId);
      expect(block).not.toBe('');
      expect(block).toMatch(/^\s{4}needs:\s*convenciones\s*$/m);
      expect(block).toMatch(/^\s{4}env:\s*$/m);
      expect(block).toMatch(/DATABASE_URL:/);
    }

    expect(extractJobBlock(workflow, 'estaticas')).not.toMatch(/^\s{4}services:\s*$/m);
    expect(extractJobBlock(workflow, 'unitarias')).not.toMatch(/^\s{4}services:\s*$/m);
    expect(extractJobBlock(workflow, 'integracion')).toMatch(/postgres:16/);
    expect(extractJobBlock(workflow, 'integracion')).toMatch(
      /pnpm build:shared && pnpm db:generate/,
    );
  });

  it('decouples e2e-shards from quality jobs without downloading artifacts', () => {
    const e2eBlock = extractJobBlock(workflow, 'e2e-shards');
    expect(e2eBlock).toMatch(/^\s{4}needs:\s*convenciones\s*$/m);
    expect(e2eBlock).not.toMatch(/download-artifact/);
  });

  it('keeps the required check names as aggregators that need every job', () => {
    const calidadBlock = extractJobBlock(workflow, 'calidad');
    expect(calidadBlock).toMatch(/name:\s*Lint, tipos, pruebas y build/);
    expect(calidadBlock).toMatch(/if:\s*always\(\)/);
    expect(calidadBlock).toMatch(
      /needs:\s*\[convenciones,\s*estaticas,\s*unitarias,\s*integracion,\s*aislamiento\]/,
    );
    expect(calidadBlock).toMatch(
      /NEEDS_RESULTS:\s*\$\{\{\s*join\(needs\.\*\.result,\s*' '\)\s*\}\}/,
    );
    expect(calidadBlock).toMatch(/--merge-reports/);
    expect(calidadBlock).toMatch(/check-shard-completeness\.mjs/);

    const integracionBlock = extractJobBlock(workflow, 'integracion');
    expect(integracionBlock).toMatch(/shard:\s*\[1\]/);
    expect(integracionBlock).toMatch(/if:\s*matrix\.shard\s*==\s*1/);
    expect(integracionBlock).toMatch(
      /--shard=\$\{\{\s*matrix\.shard\s*\}\}\/\$\{\{\s*env\.SHARDS\s*\}\}/,
    );

    const e2eBlock = extractJobBlock(workflow, 'e2e');
    expect(e2eBlock).toMatch(/name:\s*Pruebas end-to-end \(Playwright\)/);
    expect(e2eBlock).toMatch(/needs:\s*\[e2e-shards,\s*aislamiento\]/);
    expect(e2eBlock).toMatch(/NEEDS_RESULTS:\s*\$\{\{\s*join\(needs\.\*\.result,\s*' '\)\s*\}\}/);
    expect(e2eBlock).toMatch(/playwright merge-reports/);
    expect(e2eBlock).toMatch(/check-shard-completeness\.mjs/);

    const e2eShardsBlock = extractJobBlock(workflow, 'e2e-shards');
    expect(e2eShardsBlock).toMatch(/shard:\s*\[1,\s*2\]/);
    expect(e2eShardsBlock).toMatch(/fail-fast:\s*false/);
    expect(e2eShardsBlock).toMatch(
      /--shard=\$\{\{\s*matrix\.shard\s*\}\}\/\$\{\{\s*env\.SHARDS\s*\}\}/,
    );
  });

  it('makes the e2e aggregator conditional like the e2e jobs', () => {
    const e2eShardsBlock = extractJobBlock(workflow, 'e2e-shards');
    const e2eBlock = extractJobBlock(workflow, 'e2e');
    const baseCondition =
      "github.base_ref == 'develop' || (github.base_ref == 'main' && startsWith(github.head_ref, 'release/'))";

    expect(e2eShardsBlock).toContain(baseCondition);
    expect(e2eBlock).toContain(`always() && (${baseCondition})`);
  });

  it('runs worker isolation tests in their own job outside the shards', () => {
    const integracionBlock = extractJobBlock(workflow, 'integracion');
    expect(integracionBlock).toMatch(
      /--exclude src\/test\/db\/worker-isolation\.integration\.test\.ts/,
    );

    const e2eShardsBlock = extractJobBlock(workflow, 'e2e-shards');
    expect(e2eShardsBlock).toMatch(/--grep-invert "Worker isolation"/);

    const aislamientoBlock = extractJobBlock(workflow, 'aislamiento');
    expect(aislamientoBlock).toMatch(/^\s{4}needs:\s*convenciones\s*$/m);
    expect(aislamientoBlock).toMatch(/src\/test\/db\/worker-isolation\.integration\.test\.ts/);
    expect(aislamientoBlock).toMatch(/e2e\/worker-isolation\.spec\.ts/);
    expect(aislamientoBlock).toMatch(/E2E_WORKERS:\s*2/);
  });

  it('points the isolation job and the shard exclusion at the same existing file', () => {
    const integracionBlock = extractJobBlock(workflow, 'integracion');
    const aislamientoBlock = extractJobBlock(workflow, 'aislamiento');

    const excludeMatch = integracionBlock.match(
      /--exclude\s+([^\s]+worker-isolation\.integration\.test\.ts)/,
    );
    const isolationMatch = aislamientoBlock.match(
      /vitest run --project integration\s+([^\s]+worker-isolation\.integration\.test\.ts)/,
    );

    const excludeFile = excludeMatch?.[1] ?? '';
    expect(excludeFile).not.toBe('');
    expect(isolationMatch?.[1]).toBe(excludeFile);
    expect(fs.existsSync(path.join(repoRoot, 'apps', 'backend', excludeFile))).toBe(true);
  });

  it('uses one shard count in matrix, env and job name', () => {
    for (const jobId of ['integracion', 'e2e-shards']) {
      const block = extractJobBlock(workflow, jobId);
      const matrixMatch = block.match(/shard:\s*\[([^\]]+)\]/);
      const envMatch = block.match(/^\s{6}SHARDS:\s*(\d+)/m);
      const nameMatch = block.match(/^\s{4}name:.*\/(\d+)\)?\s*$/m);
      const stepMatch = block.match(/^\s{6}-\s+name:.*\/(\d+)\)?\s*$/m);

      const matrixList = matrixMatch?.[1] ?? '';
      expect(matrixList).not.toBe('');
      const matrixCount = matrixList.split(',').length;
      expect(Number(envMatch?.[1])).toBe(matrixCount);
      expect(Number(nameMatch?.[1])).toBe(matrixCount);
      expect(Number(stepMatch?.[1])).toBe(matrixCount);
    }
  });
});
