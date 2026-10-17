#!/bin/sh
# Despliegue en el servidor de Oracle (2026-10-17, sustituye a Render): baja la rama,
# reconstruye las imágenes, aplica las migraciones, hace el `next build` (necesita la
# base de datos, por eso no va dentro de `docker build`) y reinicia los servicios.
#
#   scripts/deploy.sh               despliega ahora
#   scripts/deploy.sh --if-changed  solo si GitHub tiene commits nuevos (lo llama el
#                                   temporizador cada pocos minutos: un push a la rama
#                                   desplegada acaba en la web sin tocar nada más)
#
# La rama desplegada es la que tenga el repositorio del servidor (normalmente `main`).
# Log: ~/deploy.log. Un despliegue a medias nunca para la web: el build nuevo se hace en
# build/next y solo sustituye a build/current si termina bien (volumen `webnext`).
set -eu
cd "$(dirname "$0")/.."
exec >> "$HOME/deploy.log" 2>&1

branch=$(git rev-parse --abbrev-ref HEAD)
lock="$HOME/.xkt-deploy.lock"
if ! mkdir "$lock" 2>/dev/null; then
	exit 0                      # otro despliegue en marcha
fi
trap 'rmdir "$lock"' EXIT

git fetch -q origin "$branch"
if [ "${1:-}" = "--if-changed" ] && [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$branch")" ]; then
	exit 0
fi

echo "=== $(date -Is) deploy $branch: $(git rev-parse --short HEAD) -> $(git rev-parse --short "origin/$branch")"
git merge -q --ff-only "origin/$branch"

profiles=""
grep -q '^CLOUDFLARE_TUNNEL_TOKEN=.' .env && profiles="--profile tunnel"

docker compose $profiles build
docker compose up -d db
# migraciones + build de la web con la base de datos disponible, en build/next del volumen
# `webnext`; solo si termina bien pasa a build/current (lo que sirve `web`), así que la web
# sigue sirviendo el build anterior mientras tanto y si algo falla
docker compose run --rm --no-deps -T -e NEXT_DIST_DIR=build/next web sh -c 	"rm -rf build/next && node node_modules/drizzle-kit/bin.cjs migrate && npm run build && rm -rf build/previous && { [ ! -d build/current ] || mv build/current build/previous; } && mv build/next build/current"
docker compose $profiles up -d --remove-orphans
docker compose restart web
docker image prune -f > /dev/null
echo "=== $(date -Is) deployed $(git rev-parse --short HEAD)"
