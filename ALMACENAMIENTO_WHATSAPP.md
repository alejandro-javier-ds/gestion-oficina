# Almacenamiento de Chromium para WhatsApp

Evaluación del 12 de octubre de 2026. No se modificó la aplicación, el visor,
PostgreSQL, los perfiles existentes ni los respaldos. Las propuestas de Azure
requieren una decisión previa y despliegue manual.

## Diagnóstico y alcance

En la revisión `0000014`, el usuario confirmó que IndexedDB funciona en `/tmp`
y falla con `UnknownError: Internal error` sobre `/app/whatsapp-sessions`,
montado en Azure Files SMB2 con `mfsymlinks` y sin `nobrl`. El visor remoto ya
muestra la misma instancia de Chromium que utiliza Playwright.

`lib/whatsapp/playwright.ts` abre un perfil persistente en
`/app/whatsapp-sessions/<numero>`. `lib/whatsapp/perfil.ts` comprueba escritura,
enlaces y exclusión mediante `flock`. Esas comprobaciones no prueban IndexedDB.
`docker/next-start.mjs` cierra Chromium antes de liberar el perfil durante un
apagado normal; un corte brusco puede impedir ese cierre.

El fallo depende del almacenamiento según la comparación aportada; todavía
no identifica la operación concreta de SMB que falla. Chromium utiliza bases
internas, no solamente cookies. Su implementación de IndexedDB incluye
[LevelDB](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/indexeddb/docs/idb_data_path.md),
cuyo acceso requiere [bloqueos del sistema de archivos](https://github.com/google/leveldb/blob/main/include/leveldb/env.h).

## Opciones y límites

| Opción | Persistencia y recuperación | Decisión |
| --- | --- | --- |
| SMB actual | Archivos duraderos, pero IndexedDB falla en el montaje probado. | No aprobado para ejecutar el perfil. |
| Azure Files NFS 4.1 SSD | Datos duraderos, permisos POSIX y montaje nativo en Container Apps. Sigue siendo un sistema de archivos de red. | Candidato a un piloto; no certificado para Chromium. |
| VM Linux con disco administrado y ext4 | Chromium trabaja sobre un sistema de archivos de bloques persistente; el disco permanece al reemplazar el contenedor. | Alternativa preferible si prima evitar las limitaciones de los perfiles sobre sistemas de archivos de red. Requiere otro recurso y una integración mayor. |
| ACA local con copias a Files o Blob | Puede recuperar una copia coherente anterior, pero un corte puede perder cambios posteriores, incluida una vinculación reciente. | No cumple la persistencia solicitada. |

Los [tipos de volumen documentados de ACA](https://learn.microsoft.com/en-us/azure/templates/microsoft.app/containerapps)
son `AzureFile`, `NfsAzureFile`, `EmptyDir` y `Secret`; no hay un volumen nativo
de disco administrado. `EmptyDir` sobrevive a ciertos reinicios del contenedor,
pero desaparece al reemplazar la réplica. ACA tampoco ofrece montaje nativo de
Blob o NetApp Files según su [guía de almacenamiento](https://learn.microsoft.com/en-us/azure/container-apps/storage-mounts).

Cambiar a NFS no certifica por sí mismo la integridad de todas las bases de un
perfil Chromium. SQLite también advierte sobre
[bloqueo y sincronización en sistemas de archivos de red](https://www.sqlite.org/useovernet.html)
y las [limitaciones de WAL](https://www.sqlite.org/wal.html). Esto fundamenta
la cautela; no demuestra que la prueba de IndexedDB vaya a fallar en NFS.

`nobrl` desactiva solicitudes de bloqueo por rangos y puede ayudar a algunas
cargas, según [Microsoft](https://learn.microsoft.com/en-us/troubleshoot/azure/azure-kubernetes/storage/mountoptions-settings-azure-files).
No se habilitó: el código actual lo rechaza porque debilita la exclusión entre
contenedores. Probarlo exigiría un montaje descartable y otro mecanismo de
exclusión distribuida; tampoco bastaría para demostrar recuperación segura.

No se recomienda copiar un perfil abierto: los archivos pueden corresponder
a momentos distintos. Incluso una solución con snapshots coherentes y
publicación atómica necesita declarar su pérdida máxima de cambios; guardar
solamente `storageState()` o cookies no conserva todo el perfil de WhatsApp.

## Piloto NFS propuesto

El usuario confirmó que el entorno tiene VNet propia; su configuración no se
consultó directamente. Esto permite evaluar NFS sin cambiar el tipo de red
del entorno existente.

Crear una cuenta FileStorage dedicada y un recurso compartido **clásico**
`Microsoft.Storage/storageAccounts/fileServices/shares`, SSD provisionado v2,
NFS 4.1. No usar `Microsoft.FileShares`, que ACA aún no monta. Mantener la cuenta
y el contenedor de respaldos `stgestionescaillaux/backups-postgresql` separados.
No convertir ni modificar el recurso compartido SMB actual: una misma
[carpeta compartida de Azure Files no admite SMB y NFS simultáneamente](https://learn.microsoft.com/en-us/azure/storage/files/files-nfs-protocol).

Seguridad del piloto:

- Restringir acceso a la subred autorizada mediante service endpoint, o utilizar
  private endpoint con acceso público deshabilitado. NFS autoriza por red,
  no por el rol de identidad administrada del usuario.
- Conservar permisos del proceso UID/GID 1000, directorios de perfil privados,
  un propietario por perfil y bloqueos entre contenedores. No usar `nolock` ni
  asumir que una única réplica elimina el solapamiento entre revisiones.
- El montaje NFS nativo de ACA no soporta cifrado NFS en tránsito. Hay cifrado
  en reposo y se debe aislar la red; si se exige TLS para el tráfico del sistema
  de archivos, descartar esta alternativa. Un private endpoint no añade TLS.
- Ningún puerto VNC, Chromium o almacenamiento se publica para los usuarios.
  El visor del CRM conserva su autenticación y HTTPS/WSS.

## Estimación de costo

Tarifas públicas consultadas para Central US, USD, 730 horas al mes. Son una
estimación, sin impuestos, descuentos ni compromiso de precio.

| Referencia | Costo base estimado | Exclusiones |
| --- | --- | --- |
| NFS SSD v2 LRS, 32 GiB, 3,000 IOPS y 100 MiB/s | US$3.95/mes | Cómputo del piloto, red, snapshots adicionales y mayor capacidad/rendimiento. |
| VM Linux B2s encendida continuamente | US$36.43/mes de cómputo | Discos de sistema/datos, red, snapshots y operación. Es una referencia de precio, no un dimensionamiento aprobado. |

El mínimo SSD v2 es [32 GiB, 3,000 IOPS y 100 MiB/s](https://learn.microsoft.com/en-us/azure/storage/files/storage-files-scale-targets).
El [precio de Azure Files](https://azure.microsoft.com/en-gb/pricing/details/storage/files/)
incluye los primeros 3,000 IOPS y 100 MiB/s sin cargo adicional. El cálculo usa
32 × 0.000169 USD/GiB/h × 730 = 3.94784 USD. Establecer esos mínimos expresamente;
el aprovisionamiento automático recomendado puede añadir rendimiento facturable.

La tarifa B2s consultada fue 0.0499 USD/h: 0.0499 × 730 = 36.427 USD. Un servicio
con varias sesiones Chromium puede necesitar otra VM. Los discos administrados
se montan en [VM Linux](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/disks-format-mount-data-disks-linux);
un directorio del disco temporal de la VM tampoco sirve como perfil permanente.

Consultas reproducibles del [catálogo público de Azure](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices):

- `armRegionName eq 'centralus' and productName eq 'Azure Files Provisioned v2' and skuName eq 'SSD LRS'`.
- `armRegionName eq 'centralus' and serviceName eq 'Virtual Machines' and armSkuName eq 'Standard_B2s'`, usando Linux, Consumption, sin Spot ni Low Priority.

El service endpoint no tiene cargo adicional según la documentación de NFS;
el private endpoint sí tiene costo independiente. No se estimó el cómputo ACA
ni la red del usuario porque no se inspeccionó su configuración.

## Validaciones ejecutadas

Se usó la imagen local del CRM con Chromium real, Xvfb y un volumen Docker nuevo
y exclusivo. Ninguna prueba montó Azure Files ni perfiles reales. Las pruebas
de IndexedDB se ejecutaron con red deshabilitada y sin PostgreSQL.

| Comprobación | Resultado |
| --- | --- |
| IndexedDB real con durabilidad `strict`: 128 registros y un Blob de 1 MiB | Correcto; contenido leído y comprobado completo. |
| Cookies y localStorage junto con IndexedDB | Correcto. |
| Cierre normal, retirada del primer contenedor y reapertura en otro | Datos conservados. |
| Otro contenedor intenta tomar el mismo perfil ocupado | Acceso rechazado. |
| `SIGKILL` al contenedor con una transacción confirmada y otra sin terminar | La transacción confirmada se conservó; la incompleta se descartó al abrir desde otro contenedor. |
| Chromium/perfiles/QR: 10 comprobaciones nativas | Correctas; QR de WhatsApp Web público obtenido con perfil nuevo, sin escanear ni enviar. |
| Regresiones CRM, autorización, visor, importación, PostgreSQL simulado y Blob | 116 pruebas pasaron, ninguna falló. |
| TypeScript del proyecto y de la prueba nueva | Correcto. |
| `docker build` de la imagen del proyecto | Correcto, reutilizando las capas de compilación sin cambios. |

La prueba nueva está en `tests/whatsapp-almacenamiento.mts`; se conserva localmente
según la política del proyecto y queda fuera de Git y del contexto Docker.
Los contenedores y el volumen descartable utilizados se retiraron al terminar.
No se guardaron QR en archivos ni logs.

Esto comprueba el comportamiento sobre almacenamiento local Docker, no sobre
discos de una VM Azure, SMB o NFS Azure. No hubo corte eléctrico del host, fallo
de red ni saturación del volumen. La vinculación con un teléfono y su permanencia
después de reinicios reales siguen pendientes. No se enviaron mensajes.

## Despliegue y validación manual tras decidir

1. Aprobar la alternativa y su presupuesto. Para NFS, primero crear solamente
   la cuenta y el share de piloto aislados con los parámetros anteriores.
2. Verificar subnet, reglas de acceso, resolución DNS y permisos UID/GID 1000.
   Registrar el share en el entorno como `NfsAzureFile`; montarlo en una app
   de diagnóstico separada. No modificar la revisión `0000014`.
3. Preparar una imagen de diagnóstico con las pruebas locales y una orden de
   inicio dedicada; no iniciar el CRM ni su programador de respaldos. Ejecutar
   IndexedDB, blobs, concurrencia, cierres normales, sustitución de réplica,
   `SIGKILL`, presión de disco y pérdida/recuperación de conexión de almacenamiento.
   Mantener todos los perfiles del piloto descartables.
4. Validar WhatsApp y la vinculación con un teléfono/número de prueba autorizado,
   usando una interfaz protegida. Repetir reinicio y sustitución de revisión.
   No ejecutar campañas ni enviar mensajes. Si hay fallos de integridad, rechazar
   NFS y evaluar disco administrado.
5. Si NFS supera el piloto y se acepta su riesgo, planificar una ventana para
   detener todos los propietarios reales. Con Chromium cerrado, conservar
   una copia coherente de los perfiles originales y copiar al destino nuevo
   sin sobrescribir ni borrar el origen. No asumir que un perfil ya dañado se
   repara por cambiar de almacenamiento.
6. Crear manualmente una revisión con el mismo código/imagen y cambiar únicamente
   el volumen de perfiles a NFS en `/app/whatsapp-sessions`. Conservar visor,
   dominio, HTTPS/WSS, secrets, identidad, backups y PostgreSQL. Evitar que dos
   revisiones usen simultáneamente versiones diferentes del mismo perfil.
7. Comprobar vínculo, permisos y reapertura antes de asignar tráfico. Conservar
   el origen SMB para recuperación; después de utilizar el destino, no regresar
   a un perfil antiguo sin detener propietarios y conciliar los cambios.

Si se elige VM, hay que diseñar primero el proceso de navegador en esa VM y su
comunicación privada autenticada con ACA. El mismo proceso debe suministrar
la pantalla y la sesión de Playwright. Se conservaría la interfaz del visor,
pero esa integración necesita cambios internos y aprobación adicional; no es
un montaje que pueda añadirse a la Container App actual. Mantener PostgreSQL y
el programador de respaldos en el CRM existente.

Recomendación provisional: autorizar un piloto NFS por su costo y menor alcance,
sin migrar perfiles reales hasta completar la validación. Para un requisito
estricto de evitar sistemas de archivos de red en el perfil, elegir VM con
disco administrado. Ninguna alternativa impide que WhatsApp revoque una sesión
desde sus propios servidores o desde el teléfono.
