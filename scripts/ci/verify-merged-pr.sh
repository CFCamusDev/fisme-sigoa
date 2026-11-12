#!/usr/bin/env bash
# ==============================================================================
# Verificación de que el commit proviene de un Pull Request fusionado
# Evita despliegues automáticos o avances no autorizados por push directo
# ==============================================================================
set -euo pipefail

TARGET_BRANCH="${TARGET_BRANCH:-develop}"
COMMIT_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"

echo "==> Verificando si el commit $COMMIT_SHA proviene de un PR fusionado a '$TARGET_BRANCH'..."

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: La herramienta GitHub CLI (gh) no está disponible en el entorno." >&2
  exit 1
fi

# Consulta de los PR asociados al commit
PULLS_JSON=$(gh api "repos/${GITHUB_REPOSITORY:-local/repo}/commits/${COMMIT_SHA}/pulls" 2>/dev/null || echo "[]")

# Búsqueda de un PR con estado 'closed' y 'merged_at' no nulo que apunte a TARGET_BRANCH
IS_MERGED=$(echo "$PULLS_JSON" | node -e "
const fs = require('fs');
try {
  const input = fs.readFileSync(0, 'utf-8');
  const pulls = JSON.parse(input);
  if (!Array.isArray(pulls)) {
    process.exit(1);
  }
  const target = process.env.TARGET_BRANCH;
  const match = pulls.find(p => p.state === 'closed' && p.merged_at && p.base && p.base.ref === target);
  if (match) {
    console.log(match.number);
    process.exit(0);
  }
} catch {
  process.exit(1);
}
process.exit(1);
" 2>/dev/null || true)

if [ -z "$IS_MERGED" ]; then
  echo "ERROR: El commit $COMMIT_SHA no corresponde a ningún Pull Request fusionado hacia '$TARGET_BRANCH'." >&2
  echo "Se cancela el flujo de trabajo para proteger la integridad de las ramas protegidas y entornos." >&2
  exit 1
fi

echo "✓ Confirmado: El commit $COMMIT_SHA proviene del PR #$IS_MERGED fusionado hacia '$TARGET_BRANCH'."
