#!/bin/sh
set -eu
test -n "${WHATSAPP_DATA_UUID:-}"
test "$(findmnt --noheadings --raw --mountpoint /srv/whatsapp-data --output FSTYPE)" = ext4
test "$(findmnt --noheadings --raw --mountpoint /srv/whatsapp-data --output UUID)" = "$WHATSAPP_DATA_UUID"
test -d /srv/whatsapp-data/whatsapp-sessions/.temporales
test -d /run/whatsapp-worker
test ! -L /run/whatsapp-worker
test -d /run/whatsapp-lock
test ! -L /run/whatsapp-lock
chmod 0770 /run/whatsapp-worker
chmod 0750 /run/whatsapp-lock
test ! -L /run/whatsapp-lock/worker.lock
if [ ! -e /run/whatsapp-lock/worker.lock ]; then
  (set -C; umask 077; : > /run/whatsapp-lock/worker.lock) 2>/dev/null || true
fi
test -f /run/whatsapp-lock/worker.lock
test ! -L /run/whatsapp-lock/worker.lock
chown 999:988 /run/whatsapp-lock/worker.lock
chmod 0600 /run/whatsapp-lock/worker.lock
test -d /srv/whatsapp-data/profile-backups
test ! -L /srv/whatsapp-data/profile-backups
test -f /srv/whatsapp-data/.crm-volume.json
test -r /etc/whatsapp-worker/tls/server.key
test -f /etc/whatsapp-worker/recovery-public/public.pem
test ! -L /etc/whatsapp-worker/recovery-public/public.pem
test -r /etc/whatsapp-worker/recovery-public/public.pem
docker image inspect "$WHATSAPP_IMAGE" >/dev/null
