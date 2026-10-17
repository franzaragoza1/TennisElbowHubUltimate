#!/bin/sh
# Copia de seguridad diaria de Postgres (servicio `backup` de docker-compose.yml, ver
# docs/decisiones.md 2026-10-17). Cada día a las 03:30 (hora de Italia, TZ del
# servicio) y al arrancar si la última tiene más de 20 h:
#   pg_dump -Fc  ->  cifrado AES-256 (openssl, clave BACKUP_PASSPHRASE del .env)
#   -> /backups (7 días en el servidor) -> R2, carpeta db-backups/ (14 días).
# Cifrado SIEMPRE: el bucket de R2 es público (su URL r2.dev sirve las portadas de
# noticias), cualquiera que adivinara la ruta podría bajarse el fichero, y un volcado
# lleva cuentas, sesiones y correos.
#
# Restaurar:
#   openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in X.dump.enc -out X.dump
#   pg_restore -U xkt -d xkt --clean --if-exists --no-owner --no-privileges X.dump
set -eu

: "${BACKUP_PASSPHRASE:?falta BACKUP_PASSPHRASE}"
export PGPASSWORD="$POSTGRES_PASSWORD"
DIR=/backups
mkdir -p "$DIR"

# R2 (API S3) para rclone, sin fichero de configuración: todo por variables de entorno
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

backup() {
	name="xkt-$(date +%Y%m%d-%H%M).dump.enc"
	tmp="$DIR/.$name.part"
	if pg_dump -h db -U xkt -d xkt -Fc | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -out "$tmp"; then
		mv "$tmp" "$DIR/$name"
		echo "$(date -Is) backup $name ($(du -h "$DIR/$name" | cut -f1))"
	else
		rm -f "$tmp"
		echo "$(date -Is) BACKUP FAILED (pg_dump)"
		return 1
	fi
	find "$DIR" -name 'xkt-*.dump.enc' -mtime +7 -delete
	if [ -n "${R2_BUCKET_NAME:-}" ]; then
		if rclone copyto "$DIR/$name" "r2:$R2_BUCKET_NAME/db-backups/$name" && rclone delete --min-age 14d "r2:$R2_BUCKET_NAME/db-backups/"; then
			echo "$(date -Is) uploaded to R2: db-backups/$name"
		else
			echo "$(date -Is) R2 UPLOAD FAILED (the copy on the server is kept)"
		fi
	fi
}

# al arrancar: solo si la última copia tiene más de 20 h (un despliegue no la repite)
if [ -z "$(find "$DIR" -name 'xkt-*.dump.enc' -mmin -1200 2>/dev/null | head -1)" ]; then
	backup || true
fi

while true; do
	now=$(date +%s)
	next=$(date -d "today 03:30" +%s)
	[ "$next" -le "$now" ] && next=$(date -d "tomorrow 03:30" +%s)
	sleep $((next - now))
	backup || true
done
