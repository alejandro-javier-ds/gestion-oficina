#!/bin/sh
set -eu
test -n "${WHATSAPP_DATA_UUID:-}"
test "$(findmnt --noheadings --raw --mountpoint /srv/whatsapp-data --output FSTYPE)" = ext4
test "$(findmnt --noheadings --raw --mountpoint /srv/whatsapp-data --output UUID)" = "$WHATSAPP_DATA_UUID"
test -d /srv/whatsapp-data/whatsapp-sessions/.temporales
test -f /srv/whatsapp-data/.crm-volume.json
test -r /etc/whatsapp-worker/tls/server.key
docker image inspect "$WHATSAPP_IMAGE" >/dev/null
