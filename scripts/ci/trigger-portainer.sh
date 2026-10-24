#!/usr/bin/env bash
# ==============================================================================
# Disparo seguro del Webhook de Portainer para despliegues automáticos
# Nunca imprime ni expone la URL del webhook en la salida del flujo
# ==============================================================================
set -euo pipefail

if [ -z "${PORTAINER_WEBHOOK_URL:-}" ]; then
  echo "ERROR: La variable de entorno PORTAINER_WEBHOOK_URL no está configurada o está vacía." >&2
  echo "Asegúrate de definir el secreto correspondiente en el repositorio de GitHub." >&2
  exit 1
fi

echo "==> Notificando a Portainer para actualizar y redesplegar el stack..."

MAX_RETRIES=3
RETRY_DELAY=5
SUCCESS=0

for ((i=1; i<=MAX_RETRIES; i++)); do
  echo "Intento $i de $MAX_RETRIES..."
  
  # Se ejecuta curl sin imprimir la URL secreta
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$PORTAINER_WEBHOOK_URL" || echo "000")
  
  # Códigos 200, 204 se consideran exitosos por Portainer
  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
    SUCCESS=1
    break
  else
    echo "Advertencia: El webhook respondió con código HTTP $HTTP_STATUS." >&2
    if [ "$i" -lt "$MAX_RETRIES" ]; then
      echo "Reintentando en ${RETRY_DELAY}s..."
      sleep "$RETRY_DELAY"
    fi
  fi
done

if [ "$SUCCESS" -ne 1 ]; then
  echo "ERROR: No fue posible disparar el webhook de Portainer tras $MAX_RETRIES intentos." >&2
  exit 1
fi

echo "✓ Webhook de Portainer disparado con éxito (HTTP $HTTP_STATUS). Despliegue en curso."
