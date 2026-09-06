# Imagen del scraper (scripts/autoScrape.ts) — NO la web en sí, que sigue en Vercel.
# Pensada para el servidor casero: corre `npm run autoscrape` cada 10 minutos con un
# Chromium real de verdad, algo que Vercel no puede ofrecer (ver docs/decisiones.md
# 2026-08-17 y db/schema.ts::scrapeRequests). Usa la imagen oficial de Playwright, que
# ya trae Chromium y todas sus dependencias del sistema preinstaladas — evita el
# problema de "¿qué le falta a esta máquina concreta para que Chromium arranque?" en
# una máquina que no controlamos nosotros.
#
# Versión de Playwright FIJA a la de package-lock.json — un desajuste entre la versión
# de la librería `playwright` (npm) y la del navegador que trae la imagen del sistema
# operativo rompe la conexión en tiempo de ejecución.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN chmod +x scripts/autoScrapeLoop.sh

# El perfil persistente que resuelve el challenge anti-bot UNA VEZ (ver
# lib/mana/fetchLive.ts) vive aquí — se monta como volumen (ver docker-compose.yml),
# nunca se hornea en la imagen: hay que copiarle un `.playwright/` ya resuelto de
# antemano (ni el propio contenedor headless ni un servidor sin pantalla pueden
# resolver el challenge por primera vez solos).
VOLUME ["/app/.playwright"]

CMD ["./scripts/autoScrapeLoop.sh"]
