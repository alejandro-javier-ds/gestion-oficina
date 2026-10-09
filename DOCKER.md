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

2. Genera **tres valores diferentes** con este comando y colócalos en
   `JWT_SECRET`, `DOCKER_POSTGRES_PASSWORD` y `BROWSER_DESKTOP_PASSWORD`:

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

## WhatsApp y el QR

El código actual abre Chromium con ventana. Docker incluye una pantalla virtual
para conservar ese comportamiento. La combinación local de Compose habilita
un visor en **http://localhost:6080/vnc.html?autoconnect=true&resize=scale**.
Usa el usuario `operador` y el valor de `BROWSER_DESKTOP_PASSWORD`. Después de
iniciar WhatsApp desde la aplicación, podrás ver su ventana y escanear el QR.

Los puertos locales de la aplicación y del visor escuchan solamente en
`127.0.0.1`. Con `compose.yaml` solo, el visor está desactivado. Para utilizarlo
en un servidor, habilita `ENABLE_BROWSER_DESKTOP=1`, define su contraseña y
accede mediante un túnel privado o una VPN, con TLS. El visor permite controlar
el navegador de WhatsApp: no se debe publicar directamente en Internet.

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
request y comprueba las herramientas de ejecución. No necesita contraseñas,
no publica una imagen y no despliega en Azure. Las acciones están fijadas a un
commit concreto. Las pruebas locales continúan ignoradas por Git.

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
