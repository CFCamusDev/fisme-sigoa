#!/usr/bin/env bash
# ==============================================================================
# Espera activa y validación de salud tras un despliegue en Portainer
# Consulta periódicamente el endpoint de salud hasta confirmar estado OK
# ==============================================================================
set -euo pipefail

HEALTH_URL="${HEALTH_URL:-}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-900}"
ALLOW_INSECURE="${ALLOW_INSECURE:-0}"
INTERVAL=10

if [ -z "$HEALTH_URL" ]; then
  echo "ERROR: La variable HEALTH_URL no está definida." >&2
  exit 1
fi

# Validación de seguridad: exigir protocolo HTTPS en entornos remotos
if [ "$ALLOW_INSECURE" != "1" ] && [[ ! "$HEALTH_URL" =~ ^https:// ]]; then
  echo "ERROR: La URL de salud '$HEALTH_URL' debe utilizar protocolo seguro HTTPS (conforme a RNF-001)." >&2
  echo "Para pruebas locales no seguras, configure explícitamente ALLOW_INSECURE=1." >&2
  exit 1
fi

echo "==> Esperando que el servicio responda en $HEALTH_URL (tiempo límite: ${TIMEOUT_SECONDS}s)..."

ELAPSED=0
SUCCESS=0

while [ "$ELAPSED" -lt "$TIMEOUT_SECONDS" ]; do
  BODY=$(curl -s -f -m 5 "$HEALTH_URL" 2>/dev/null || true)
  
  if grep -qi '"status"[[:space:]]*:[[:space:]]*"ok"' <<< "$BODY"; then
    SUCCESS=1
    break
  fi
  
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
  echo "Esperando respuesta saludable... (${ELAPSED}s / ${TIMEOUT_SECONDS}s)"
done

if [ "$SUCCESS" -ne 1 ]; then
  echo "ERROR: Se agotó el tiempo límite (${TIMEOUT_SECONDS}s) esperando salud exitosa en $HEALTH_URL." >&2
  exit 1
fi

echo "✓ Verificación exitosa: El entorno respondió saludable en ${ELAPSED}s."
