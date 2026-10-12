# Ejecutar Gestión de Oficina con Docker

La imagen contiene la aplicación compilada, Chromium para WhatsApp y el cliente
PostgreSQL 18 para los backups. Se ejecuta con el usuario `node`, sin privilegios
de administrador. La lógica de la aplicación sigue siendo la misma.

`compose.yaml` ejecuta la aplicación contra una base externa.
`compose.local.yaml` añade una base propia de Docker para comprobar todo en local.
Esa base utiliza un volumen independiente y **no publica el puerto 5432**. No usa
los archivos, la configuración ni el servicio de tu PostgreSQL 18 de Windows.

## Primera ejecución en local

Desde la carpeta del proyecto, con Docker Desktop iniciado en modo Linux:

1. Copia la configuración de ejemplo, sin reemplazar un archivo que ya tengas:

   ```powershell
   if (!(Test-Path .env.docker)) { Copy-Item docker/environment.example .env.docker }
   ```

2. Genera **dos valores diferentes** con este comando y colócalos en
   `JWT_SECRET` y `DOCKER_POSTGRES_PASSWORD`:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   `.env.docker` queda ignorado por Git y Docker. En esta configuración local,
   `DATABASE_URL` puede quedar vacío: la combinación de archivos Compose utiliza
   automáticamente la base aislada llamada `db`. Usa valores hexadecimales para
   la contraseña de esta base, como los generados por el comando anterior.

3. Compila la imagen y levanta únicamente la base nueva:

   ```powershell
   docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml build app
   docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml up -d db
   ```

4. Crea las tablas en esa base vacía:

   ```powershell
   docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml run --rm app init-db
   ```

   `init-db` aplica los esquemas existentes en una sola transacción. Si encuentra
   tablas, se detiene sin cambiarlas. No es un comando para actualizar ni borrar
   una base existente, y no se ejecuta automáticamente al arrancar.

5. Crea el **primer administrador**. Este ejemplo de PowerShell solicita sus
   datos y oculta la contraseña al escribirla; no la guarda en un archivo:

   ```powershell
   $env:BOOTSTRAP_ADMIN_USERNAME = Read-Host 'Usuario del administrador'
   $env:BOOTSTRAP_ADMIN_NAME = Read-Host 'Nombre completo'
   $dockerAdminPassword = Read-Host 'Contraseña inicial (mínimo 12 caracteres)' -AsSecureString
   $dockerAdminPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dockerAdminPassword)
   try {
     $env:BOOTSTRAP_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($dockerAdminPointer)
     docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml run --rm -e BOOTSTRAP_ADMIN_USERNAME -e BOOTSTRAP_ADMIN_NAME -e BOOTSTRAP_ADMIN_PASSWORD app create-admin
   } finally {
     [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($dockerAdminPointer)
     Remove-Item Env:BOOTSTRAP_ADMIN_USERNAME, Env:BOOTSTRAP_ADMIN_NAME, Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
     Remove-Variable dockerAdminPassword, dockerAdminPointer
   }
   ```

   Solo funciona si todavía no existen usuarios. Guarda la contraseña cifrada
   y obliga a cambiarla al iniciar sesión. Los demás usuarios se crean desde el
   panel de administración. No hay un usuario ni una contraseña predeterminados
   dentro del repositorio o de la imagen.

6. Arranca la aplicación:

   ```powershell
   docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml up -d app
   docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml ps
   ```

   Abre **http://localhost:3001**. El puerto 3000 de tu desarrollo local sigue
   disponible. El estado `healthy` comprueba tanto Next.js como las tablas de la
   base; puede tardar unos segundos en aparecer. Cambia la contraseña inicial y
   carga el portafolio desde el panel habitual.

## WhatsApp remoto y QR

**Agregar número** guarda el teléfono y su propietario para el selector y los
tenores sin exigir vincular WhatsApp. **Abrir WhatsApp** o **Vincular WhatsApp**
abre una pestaña del CRM que muestra el Chromium del contenedor, completo.
Es la misma página y el mismo perfil que utiliza Playwright para los envíos.

El visor usa noVNC con una pantalla Xvfb privada por sesión. Los números distintos
no comparten escritorio. x11vnc escucha exclusivamente en `127.0.0.1` dentro del
contenedor; el navegador se conecta por WSS al mismo dominio HTTPS del CRM.
El gateway de `docker/gateway.mjs` comparte el puerto 3000 con la aplicación y
mantiene el servidor standalone de Next.js en un puerto interno de loopback.
No se publican VNC, websockify ni Chromium. El antiguo visor del puerto 6080
ya no se inicia ni se publica en Compose.

El origen de producción permitido es exclusivamente:
`https://ca-gestiones-caillaux.politehill-e3f16b67.centralus.azurecontainerapps.io`.
No se admiten comodines ni listas de orígenes. Compose usa únicamente
`http://localhost:3001` para desarrollo, o el puerto local configurado en `APP_PORT`.

La entrada al visor exige sesión vigente, usuario activo, cambio de contraseña
completado, rol administrador o supervisor y acceso al número. Los números
registrados y activos conservan los permisos compartidos de esos dos roles;
las sesiones temporales solo son accesibles por su creador. El gateway repite
la autorización cada cinco segundos y cierra la conexión ante revocación,
cambio de permisos o pérdida de Chromium. Si vence el JWT original del socket,
el cliente solo reconecta después de comprobar nuevamente su acceso por HTTPS.

El puerto privado y el identificador de escritorio se resuelven mediante una
API interna protegida por una clave aleatoria creada al arrancar. La clave nunca
llega al navegador ni se configura en Azure. Un identificador de ventana no
autoriza por sí solo una conexión. Las respuestas del visor usan
`Cache-Control: private, no-store, max-age=0`. No se guardan imágenes, QR,
eventos de teclado, cookies o perfiles en logs. El portapapeles remoto está
deshabilitado.

Chromium recibe únicamente variables de entorno necesarias para su pantalla,
sin las credenciales PostgreSQL, JWT o identidad de Azure. La imagen instala
políticas de solo lectura, propiedad de root, que bloquean archivos locales,
páginas internas y navegación a endpoints de loopback o metadatos. Los diálogos
para elegir archivos del servidor están deshabilitados. Esto también impide
adjuntar archivos del contenedor desde la ventana remota; las campañas de texto
conservan su funcionamiento existente.

La pestaña empieza en **Solo ver**. Usa **Activar control** para interactuar con
WhatsApp; escanea desde **WhatsApp → Dispositivos vinculados** en el celular.
Durante una campaña conserva **Solo ver**, porque las acciones manuales sobre
la misma ventana pueden interferir con Playwright. Cerrar la pestaña desconecta
el visor, pero conserva Chromium y su perfil para los envíos y posteriores visitas.

La extracción del QR dentro del panel se mantiene como ayuda; el visor remoto
funciona independientemente de que los selectores del QR reconozcan la página.
Si WhatsApp no muestra QR ni conversaciones durante 90 segundos, el estado deja
de permanecer indefinidamente en «Conectando» y pide revisar la ventana remota.
La apertura inicial comprueba errores HTTP al cargar WhatsApp. No se puede
deducir la causa concreta de un perfil de producción sin observar esa ventana.

Los perfiles permanentes conservan `/app/whatsapp-sessions/<numero>`.
Las sesiones temporales conservan su carpeta separada en `.temporales`.
Los bloqueos `flock` por perfil, la comprobación de escritura/enlaces simbólicos
y la recuperación segura de enlaces obsoletos permanecen vigentes.
Azure Files SMB requiere escritura para UID 1000, `mfsymlinks` y bloqueos
entre clientes habilitados, sin `nobrl`. No se eliminan perfiles para reconectar.

**Incidente de almacenamiento, 12 de octubre de 2026:** en la revisión
`0000014` el visor funciona, pero la prueba de IndexedDB reportada desde Azure
falla sobre SMB y funciona en `/tmp`. Los requisitos anteriores verifican
permisos y exclusión del perfil; no certifican las bases internas de Chromium.
No debe considerarse aprobado ese montaje para WhatsApp. Consulta
[la evaluación de almacenamiento](ALMACENAMIENTO_WHATSAPP.md) antes de cambiar
el volumen. El visor y los perfiles existentes se conservan.

`docker/next-start.mjs` gestiona el apagado del servidor para cerrar Chromium
antes de liberar su perfil y pantalla. Playwright deja esa gestión de señales
al contenedor cuando el visor está habilitado. El apagado tiene un límite de
18 segundos; una terminación forzada o la desvinculación desde el teléfono
pueden requerir un nuevo escaneo.

[API de noVNC](https://novnc.com/noVNC/docs/API.html),
[ingreso de Container Apps y WebSockets](https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview)
y [montajes de Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/storage-mounts).
Las restricciones de navegador usan [políticas administradas de Chromium](https://www.chromium.org/administrators/linux-quick-start/).

## Validación del visor

Las pruebas locales cubren la autorización por rol y número, la revocación de
usuarios, la apertura simultánea, los estados y el transporte del visor. También
se ejecutan las regresiones de lógica, importación, PostgreSQL simulado y Blob:
116 pruebas, sin conexión a la base de producción. TypeScript y ESLint se
comprueban sobre los archivos cambiados y la imagen se compila en Docker.

La validación del servidor compilado utiliza HTTPS/WSS, noVNC y Chromium reales
con páginas sintéticas. Comprueba 12 casos: acceso, aislamiento entre dos números,
teclado y ratón sobre la misma página de Playwright, revocación, estado conectado,
restricciones del navegador y persistencia después del reinicio. Otras 10
comprobaciones de Chromium validan bloqueo, almacenamiento y un QR obtenido de
WhatsApp Web público con un perfil nuevo, sin escanearlo ni enviar mensajes.
Las pruebas se conservan localmente, ignoradas por Git y Docker; el QR real no
se guarda en capturas ni logs.

Quedan pendientes la revisión desplegada en Azure, las opciones y permisos de
su montaje Azure Files SMB, el escaneo con un teléfono y un envío controlado
expresamente autorizado. Una prueba en Docker no confirma el funcionamiento en
producción. Las instrucciones siguientes describen el despliegue manual.

## Desplegar esta corrección en Azure Portal

1. Espera que el workflow **Docker** del commit **Sistema CRM** termine correctamente.
   La imagen se publica en el ACR existente con la etiqueta SHA de ese commit.
2. En **Container Apps → ca-gestiones-caillaux → Containers → Edit and deploy**,
   selecciona `acrgestionescaillaux-hwg9a5hvg7f6bxeu.azurecr.io/gestion-oficina:<SHA_DEL_COMMIT>`.
   Mantén el comando predeterminado de la imagen y todas las variables,
   referencias a secretos, identidad administrada y volúmenes existentes.
   No ejecutes `init-db` ni `create-admin` sobre esta base de producción.
3. Comprueba estas variables en la nueva revisión:
   - `WHATSAPP_REMOTE_VIEWER=1`.
   - `CRM_PUBLIC_ORIGIN=https://ca-gestiones-caillaux.politehill-e3f16b67.centralus.azurecontainerapps.io`.
   - `PORT=3000` y `HOSTNAME=0.0.0.0`.
   No agregues `WHATSAPP_VISOR_INTERNAL_SECRET`, contraseñas VNC ni claves de Blob.
   El visor compartido antiguo queda deshabilitado aunque existiera una variable
   `ENABLE_BROWSER_DESKTOP` de una configuración anterior.
4. En **Ingress**, mantén el ingreso HTTP existente con destino **3000**,
   transporte **Auto** y **Allow insecure connections** desactivado.
   No agregues puertos 5900, 6080 ni un puerto de depuración de Chromium.
5. Usa **una revisión activa**, escala mínima **1** y máxima **1**.
   Después de que la nueva revisión esté sana y reciba el 100 % del tráfico,
   comprueba que `ca-gestiones-caillaux--0000013` y cualquier otra revisión
   anterior hayan terminado antes de abrir sus perfiles. La sesión reside en
   un proceso; esta implementación no distribuye Chromium entre réplicas.
6. Conserva el montaje de `/app/whatsapp-sessions` y los volúmenes de respaldos.
   Comprueba los permisos, `mfsymlinks` y la ausencia de `nobrl` del montaje de
   WhatsApp. Si un bloqueo indica que otro contenedor usa el perfil, espera su
   cierre; no borres el perfil ni sus datos.
7. En el dominio principal, inicia sesión como administrador o supervisor,
   selecciona el número y pulsa **Abrir WhatsApp**. Permite la pestaña emergente
   si el navegador la bloquea; también está disponible **Ver ventana de WhatsApp**.
   Escanea el QR, confirma **WhatsApp conectado** y conserva **Solo ver** al
   observar las campañas que autorices desde el CRM.
8. La validación de un envío real queda pendiente. Realiza solo una prueba
   pequeña, a un destinatario de prueba y expresamente autorizada. Las pruebas
   automatizadas no envían mensajes ni habilitan campañas reales.

Cada sesión activa añade un Chromium, una pantalla Xvfb y x11vnc. Vigila memoria
y CPU si utilizas varios números a la vez. La persistencia depende del montaje
y de que WhatsApp mantenga el vínculo; WhatsApp puede solicitar otro escaneo.

## Persistencia y operación

Compose utiliza volúmenes independientes para la base, los backups y las
sesiones de WhatsApp. Reiniciar o recrear el contenedor de la aplicación
conserva esos datos. Los backups se pueden crear y descargar desde el panel.

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml logs --tail=100 app
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml down
```

`down` detiene los contenedores y conserva los volúmenes. Mantén el mismo nombre
de proyecto Compose para reutilizarlos. La aplicación no ejecuta importaciones,
migraciones ni creación de usuarios automáticamente al arrancar.

## GitHub primero

Sube el `Dockerfile`, los dos archivos Compose, `.dockerignore`, `.gitattributes`,
la carpeta `docker`, esta guía, el cambio de `next.config.ts` y el workflow
`.github/workflows/docker.yml`, junto con el código de la aplicación.

El workflow compila la imagen desde el checkout limpio en cada push o pull
request y comprueba las herramientas de ejecución. En `main`, el flujo existente
utiliza OIDC para publicar la imagen verificada en ACR con las etiquetas del commit
y `latest`; no despliega una revisión de Container Apps. Los pull requests y otras
ramas solo validan. Las pruebas locales continúan ignoradas por Git.

`.dockerignore` admite solo el código necesario para compilar y los dos
esquemas SQL. Excluye `.env*`, pruebas, bases locales, portafolios reales,
backups, sesiones de WhatsApp y `node_modules`. El archivo
`docker/environment.example` contiene únicamente campos vacíos de configuración.
No agregues credenciales o datos reales a los archivos admitidos.

## Usar la misma imagen en Azure

La configuración de Azure se hace después. La imagen de producción ya escucha
en `0.0.0.0:3000`; el servicio de Azure deberá dirigir el tráfico a ese puerto
y servir la aplicación por HTTPS.

Configura allí `DATABASE_URL` con la base de Azure y TLS, y un `JWT_SECRET`
propio. Son variables de **ejecución**, no argumentos de compilación. No copies
`.env.local` ni rutas de Windows al servidor.

Si la base de destino está vacía, ejecuta esta misma imagen con `init-db` y
después con `create-admin`, suministrando las variables `BOOTSTRAP_ADMIN_*`
solo para ese comando privado. Si la base ya existe, conecta la aplicación a
ella sin ejecutar `init-db`.

Conserva almacenamiento persistente para `/app/backups`,
`/app/whatsapp-sessions` y `/app/.whatsapp-sesiones`, con permiso de escritura
para el usuario `node` (UID 1000). Para Chromium, asigna memoria compartida
equivalente a `shm_size: 1gb`. Mantén una instancia mientras las sesiones de
WhatsApp y el programador de backups sigan gestionándose dentro del proceso.

La versión de Node de la imagen está fijada por digest. Al actualizar
dependencias o la base de Node, vuelve a compilar y validar la imagen; Chromium
se instala según la versión de Playwright del `package-lock.json`.

Referencias: [Next.js y Docker](https://docs.docker.com/guides/nextjs/),
[Playwright en Docker](https://playwright.dev/docs/docker),
[imagen oficial PostgreSQL](https://hub.docker.com/_/postgres) y
[Docker en GitHub Actions](https://docs.docker.com/build/ci/github-actions/).
