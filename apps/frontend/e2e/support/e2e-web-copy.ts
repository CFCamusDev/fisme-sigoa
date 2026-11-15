import fs from 'node:fs';
import path from 'node:path';

export const E2E_API_PLACEHOLDER = 'http://sigoa-e2e-api.invalid';

function rewriteTextFiles(dir: string, placeholder: string, apiUrl: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteTextFiles(fullPath, placeholder, apiUrl);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (ext !== '.js' && ext !== '.html') {
      continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(placeholder)) {
      fs.writeFileSync(fullPath, content.replaceAll(placeholder, apiUrl), 'utf8');
    }
  }
}

export function copyWebBuildWithApiUrl(baseDir: string, targetDir: string, apiUrl: string): void {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(baseDir, targetDir, { recursive: true });
  rewriteTextFiles(targetDir, E2E_API_PLACEHOLDER, apiUrl);
}
