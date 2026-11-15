import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import vitestProjects from '../vitest-projects.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

const ALL_TEST_PATTERNS = ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.mjs'];
const FORBIDDEN_NODE_IMPORTS = [
  '@testing-library/react',
  '@testing-library/user-event',
  '@testing-library/jest-dom',
  'jsdom',
  'happy-dom',
];

function globFrontend(patterns: string[]): string[] {
  const matched = patterns.flatMap((pattern) =>
    fs.globSync(pattern, { cwd: frontendRoot }).map((file) => file.replaceAll('\\', '/')),
  );
  return [...new Set(matched)].sort();
}

function partitionFiles() {
  const allFiles = globFrontend(ALL_TEST_PATTERNS);
  const nodeCandidates = new Set(globFrontend(vitestProjects.nodeInclude));
  const exceptionSet = new Set(vitestProjects.nodeExceptions.map((entry) => entry.file));

  const nodeFiles = [...nodeCandidates].filter((file) => !exceptionSet.has(file)).sort();
  const nodeFileSet = new Set(nodeFiles);
  const domFiles = allFiles.filter((file) => !nodeFileSet.has(file)).sort();

  return { allFiles, nodeCandidates, exceptionSet, nodeFiles, domFiles };
}

describe('vitest projects configuration', () => {
  it('runs every test file in exactly one project', () => {
    const { allFiles, nodeCandidates, exceptionSet, nodeFiles, domFiles } = partitionFiles();

    const nodeSet = new Set(nodeFiles);
    const domSet = new Set(domFiles);

    for (const file of allFiles) {
      const inNode = nodeSet.has(file);
      const inDom = domSet.has(file);
      expect(inNode !== inDom, `Expected ${file} in exactly one project`).toBe(true);
    }

    for (const file of nodeFiles) {
      expect(file.endsWith('.tsx')).toBe(false);
      expect(allFiles).toContain(file);
    }

    for (const exceptionFile of exceptionSet) {
      expect(allFiles).toContain(exceptionFile);
      expect(nodeCandidates.has(exceptionFile)).toBe(true);
      expect(domSet.has(exceptionFile)).toBe(true);
    }
  });

  it('keeps the dom libraries out of the node project files', () => {
    const { nodeFiles } = partitionFiles();
    const filesToCheck = [...nodeFiles, 'src/test/setup-node.ts'];

    for (const relativeFile of filesToCheck) {
      const content = fs.readFileSync(path.join(frontendRoot, relativeFile), 'utf8');
      for (const forbidden of FORBIDDEN_NODE_IMPORTS) {
        expect(content, `${relativeFile} must not import ${forbidden}`).not.toContain(forbidden);
      }
    }

    const setupNodeContent = fs.readFileSync(
      path.join(frontendRoot, 'src/test/setup-node.ts'),
      'utf8',
    );
    expect(setupNodeContent).not.toMatch(/\b(window|document)\b/);
  });

  it('lists a reason for every node exception', () => {
    for (const entry of vitestProjects.nodeExceptions) {
      expect(typeof entry.file).toBe('string');
      expect(entry.file.trim().length).toBeGreaterThan(0);
      expect(typeof entry.reason).toBe('string');
      expect(entry.reason.trim().length).toBeGreaterThan(0);
    }
  });
});
