#!/usr/bin/env bash
# Bucle del contenedor Docker (ver Dockerfile) — un contenedor corre UN proceso en
# primer plano, así que esto es lo que reemplaza a Task Scheduler/cron en una máquina
# normal: ejecuta `npm run autoscrape` y espera 10 minutos, para siempre. Un fallo de
# una pasada (challenge anti-bot, red caída) no tumba el bucle — la siguiente pasada
# simplemente lo vuelve a intentar, mismo criterio de resiliencia que el resto del
# proyecto (nunca falla ruidosamente por un problema pasajero).
set -u
INTERVAL_SECONDS="${AUTOSCRAPE_INTERVAL_SECONDS:-600}"

echo "autoScrapeLoop: arrancando, pasada cada ${INTERVAL_SECONDS}s"
while true; do
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) — pasada de autoscrape ==="
  # La pasada misma espera hasta completar INTERVAL_SECONDS mirando la cola del panel cada 15 s
  # (scripts/autoScrape.ts::pollRequestsUntil): un botón de admin se ejecuta en segundos.
  AUTOSCRAPE_POLL_SECONDS="$INTERVAL_SECONDS" npm run autoscrape || { echo "✗ La pasada falló — se reintenta en la siguiente vuelta."; sleep 60; }
  sleep 5
done
