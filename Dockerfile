# La misma imagen se usa en local y en Azure; los secretos llegan al ejecutarla.
ARG NODE_IMAGE=node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev --no-audit --no-fund

FROM dependencies AS builder
COPY . .
# Valores sintéticos para validar módulos durante build, sin conexión a una BD.
RUN NEXT_OUTPUT=standalone \
    DATABASE_URL=postgresql://build_only:build_only@127.0.0.1:1/build_only \
    JWT_SECRET=build-only-placeholder-never-used-for-runtime-sessions \
    npm run build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 HOSTNAME=0.0.0.0 TZ=America/Lima \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright DISPLAY=:99 \
    ENABLE_BROWSER_DESKTOP=0 WHATSAPP_REMOTE_VIEWER=1 \
    CRM_PUBLIC_ORIGIN=https://ca-gestiones-caillaux.politehill-e3f16b67.centralus.azurecontainerapps.io

# Cliente 18 para respaldos; la base de datos vive fuera de este contenedor.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl tini \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main' \
       > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-18 \
       xvfb xauth x11vnc novnc websockify fluxbox util-linux \
    && rm -rf /var/lib/apt/lists/*

# Playwright es externo en Next; se copia completo y con su versión bloqueada.
# Se instala antes del código para reutilizar Chromium al cambiar la aplicación.
COPY --from=dependencies /app/node_modules/playwright ./node_modules/playwright
COPY --from=dependencies /app/node_modules/playwright-core ./node_modules/playwright-core
COPY --from=dependencies /app/node_modules/ws ./node_modules/ws
RUN node node_modules/playwright/cli.js install --with-deps chromium \
    && chmod -R a+rX /ms-playwright \
    && rm -rf /var/lib/apt/lists/* /root/.npm

RUN install -d -m 755 /etc/opt/chrome_for_testing/policies/managed \
    /etc/opt/chrome/policies/managed /etc/chromium/policies/managed
COPY --chown=root:root --chmod=644 docker/chromium-policy.json /etc/opt/chrome_for_testing/policies/managed/crm.json
COPY --chown=root:root --chmod=644 docker/chromium-policy.json /etc/opt/chrome/policies/managed/crm.json
COPY --chown=root:root --chmod=644 docker/chromium-policy.json /etc/chromium/policies/managed/crm.json

# Next integra bcryptjs en sus bundles; el comando de alta necesita el paquete.
COPY --from=dependencies /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node docker/*.mjs docker/entrypoint.sh ./docker/
COPY --chown=node:node scripts/postgres/001-schema.sql scripts/postgres/004-ajustes-portafolio.sql ./docker/schema/
RUN chmod 755 docker/entrypoint.sh \
    && mkdir -p backups whatsapp-sessions .whatsapp-sesiones .next/cache \
    && chown -R node:node backups whatsapp-sessions .whatsapp-sesiones .next/cache

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
    CMD ["node", "docker/healthcheck.mjs"]
ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker/entrypoint.sh"]
CMD ["app"]
