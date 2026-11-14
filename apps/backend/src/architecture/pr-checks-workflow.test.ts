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

  it('splits quality into independent jobs that declare env per job', () => {
    for (const jobId of ['estaticas', 'unitarias', 'integracion']) {
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
});
