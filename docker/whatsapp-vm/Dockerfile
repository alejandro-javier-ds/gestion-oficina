FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY lib/whatsapp ./lib/whatsapp
COPY docker/whatsapp-wire.mjs ./docker/whatsapp-wire.mjs
COPY docker/whatsapp-vm ./docker/whatsapp-vm
RUN node --input-type=module -e 'import {build} from "esbuild"; await build({entryPoints:["docker/whatsapp-vm/worker.mts"],outfile:"worker.mjs",bundle:true,platform:"node",format:"esm",external:["playwright","ws"]});'

FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS runtime
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tini util-linux xvfb x11vnc python3 && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 988 whatsappsvc && useradd --uid 999 --gid 988 --system --no-create-home --home-dir /data/runtime --shell /usr/sbin/nologin whatsappsvc
COPY --from=build /build/node_modules/playwright /app/node_modules/playwright
COPY --from=build /build/node_modules/playwright-core /app/node_modules/playwright-core
COPY --from=build /build/node_modules/ws /app/node_modules/ws
RUN node /app/node_modules/playwright/cli.js install --with-deps chromium && chmod -R a+rX /ms-playwright && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /recovery /backup /run/crm-control /run/crm-lock && chmod 555 /recovery /backup /run/crm-control /run/crm-lock
COPY docker/chromium-policy.json /etc/chromium/policies/managed/crm.json
COPY docker/chromium-policy.json /etc/opt/chrome/policies/managed/crm.json
COPY docker/chromium-policy.json /etc/opt/chrome_for_testing/policies/managed/crm.json
COPY --from=build /build/worker.mjs /app/worker.mjs
COPY docker/whatsapp-vm/storage.mjs docker/whatsapp-vm/maintenance.mjs docker/whatsapp-vm/health.mjs docker/whatsapp-vm/extract.py docker/whatsapp-vm/entrypoint.sh /app/
RUN chmod 555 /app/entrypoint.sh && chmod 444 /app/*.mjs /app/*.py /etc/chromium/policies/managed/crm.json
USER 999:988
ENV HOME=/data/runtime TMPDIR=/data/runtime/tmp
EXPOSE 8443
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 CMD ["node", "/app/health.mjs"]
ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]
CMD ["worker"]
