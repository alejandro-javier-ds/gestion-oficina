#!/bin/sh
set -eu
case "${1:-worker}" in
  worker)
    node /app/storage.mjs check
    exec flock --exclusive --nonblock --no-fork /run/crm-lock/worker.lock node /app/worker.mjs
    ;;
  backup)
    node /app/storage.mjs check-readonly
    exec flock --exclusive --nonblock --no-fork /run/crm-lock/worker.lock node /app/maintenance.mjs "$@"
    ;;
  restore)
    node /app/storage.mjs check
    exec flock --exclusive --nonblock --no-fork /run/crm-lock/worker.lock node /app/maintenance.mjs "$@"
    ;;
  *) exit 64 ;;
esac
