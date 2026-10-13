#!/bin/sh
set -eu
node /app/storage.mjs check
case "${1:-worker}" in
  worker) exec flock --exclusive --nonblock --no-fork /data/.crm-worker.lock node /app/worker.mjs ;;
  backup|restore) exec flock --exclusive --nonblock --no-fork /data/.crm-worker.lock node /app/maintenance.mjs "$@" ;;
  *) exit 64 ;;
esac
