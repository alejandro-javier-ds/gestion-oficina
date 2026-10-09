set -eu
umask 077

if [ -z "${DATABASE_URL:-}" ]; then
    echo 'Falta DATABASE_URL para el contenedor.' >&2
    exit 1
fi

case "${1:-app}" in
    app)
        if [ -z "${JWT_SECRET:-}" ] || [ "${#JWT_SECRET}" -lt 32 ]; then
            echo 'JWT_SECRET debe tener al menos 32 caracteres.' >&2
            exit 1
        fi
        exec node /app/docker/start.mjs
        ;;
    init-db|create-admin)
        exec node /app/docker/database.mjs "$@"
        ;;
    *)
        echo 'Comandos disponibles: app, init-db, create-admin.' >&2
        exit 1
        ;;
esac
