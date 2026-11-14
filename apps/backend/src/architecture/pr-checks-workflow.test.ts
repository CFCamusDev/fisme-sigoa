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
      /needs:\s*\[convenciones,\s*estaticas,\s*unitarias,\s*integracion\]/,
    );
    expect(calidadBlock).toMatch(
      /NEEDS_RESULTS:\s*\$\{\{\s*join\(needs\.\*\.result,\s*' '\)\s*\}\}/,
    );

    const e2eBlock = extractJobBlock(workflow, 'e2e');
    expect(e2eBlock).toMatch(/name:\s*Pruebas end-to-end \(Playwright\)/);
    expect(e2eBlock).toMatch(/needs:\s*\[e2e-shards,\s*e2e-informe\]/);
    expect(e2eBlock).toMatch(/NEEDS_RESULTS:\s*\$\{\{\s*join\(needs\.\*\.result,\s*' '\)\s*\}\}/);

    const e2eShardsBlock = extractJobBlock(workflow, 'e2e-shards');
    expect(e2eShardsBlock).toMatch(/shard:\s*\[1,\s*2,\s*3\]/);
    expect(e2eShardsBlock).toMatch(/fail-fast:\s*false/);
    expect(e2eShardsBlock).toMatch(
      /--shard=\$\{\{\s*matrix\.shard\s*\}\}\/\$\{\{\s*env\.SHARDS\s*\}\}/,
    );

    const e2eInformeBlock = extractJobBlock(workflow, 'e2e-informe');
    expect(e2eInformeBlock).toMatch(/needs:\s*e2e-shards/);
    expect(e2eInformeBlock).toMatch(/playwright merge-reports/);
    expect(e2eInformeBlock).toMatch(/check-shard-completeness\.mjs/);
  });

  it('makes the e2e aggregator conditional like the e2e jobs', () => {
    const e2eShardsBlock = extractJobBlock(workflow, 'e2e-shards');
    const e2eBlock = extractJobBlock(workflow, 'e2e');
    const baseCondition =
      "github.base_ref == 'develop' || (github.base_ref == 'main' && startsWith(github.head_ref, 'release/'))";

    expect(e2eShardsBlock).toContain(baseCondition);
    expect(e2eBlock).toContain(`always() && (${baseCondition})`);
  });
});
