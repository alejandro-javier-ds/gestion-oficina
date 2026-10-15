# Respaldos PostgreSQL

## Flujo

El respaldo se genera con `pg_dump --format=custom` en un directorio temporal del contenedor. Ese directorio se crea con acceso privado en el almacenamiento efímero local; no contiene credenciales en nombres de archivo ni en logs. `pg_restore --list` valida el archivo antes de moverlo al volumen persistente.

Después, la aplicación crea un archivo temporal exclusivo en `/app/backups`, copia el contenido, sincroniza la escritura, compara tamaño y SHA-256 con el origen y vuelve a validar el archivo. Solo entonces publica el nombre `.dump` mediante un rename en el mismo volumen. Un fallo o interrupción antes de publicar deja como máximo un temporal `.partial`, que la lista de respaldos y las rutas de descarga ignoran. Los temporales propios abandonados con más de 24 horas se limpian bajo el bloqueo del respaldo.

El flujo no ejecuta `chmod` ni hard links sobre Azure Files. No modifica ACL ni opciones del montaje. La publicación depende de que el volumen admita creación exclusiva y rename dentro del mismo directorio; si alguna operación falla, el archivo final no se informa como creado.

Un bloqueo advisory de PostgreSQL serializa las ejecuciones manuales y programadas en todas las réplicas. No altera tablas ni datos y se libera al cerrar la conexión. El programador conserva lunes y jueves a las 5:00 p. m., zona `America/Lima`; `noOverlap` evita solapamientos del mismo proceso.

## Resultado local y Blob

La API informa por separado el estado local y el estado de Azure Blob. Si el respaldo local fue verificado y la carga remota falla, devuelve HTTP 502 con `localOk: true`, conserva el archivo en Azure Files y el panel indica que la copia Blob está pendiente. La acción «Recuperar en Azure Blob» permite reintentar sin sobrescribir objetos: una copia existente solo cuenta como verificada cuando coinciden tamaño y SHA-256.

La rotación conserva los 30 respaldos locales más recientes. Un respaldo antiguo solo se elimina después de que Blob confirma que la copia coincide en tamaño y SHA-256. Si Blob falla o hay conflicto, el archivo local se conserva.

## Acceso a Azure Files

Los bits POSIX solicitados al crear un archivo no prueban la ACL efectiva de una compartición SMB. La aplicación no cambia permisos del volumen. Antes de desplegar, comprueba en Azure Portal que `/app/backups` usa el volumen Azure Files previsto, está en modo `ReadWrite`, que el acceso de red sigue limitado al canal privado existente y que solo las aplicaciones que necesitan leer esos respaldos montan esa compartición. Container Apps permite que todos los contenedores que montan la misma compartición accedan a sus archivos; el aislamiento debe confirmarse en la configuración y ACL efectivas de Azure Files, no inferirse de `stat`.

La configuración de montaje y las ACL de producción no se pudieron inspeccionar desde este checkout local. Para revisar el montaje desde una réplica autorizada:

```sh
az containerapp exec --resource-group <GRUPO> --name ca-gestiones-caillaux --command "sh -lc 'id; findmnt -T /app/backups -o TARGET,FSTYPE,SOURCE,OPTIONS; stat -c \"%a %A %u:%g %n\" /app/backups'"
```

Ese comando confirma el montaje visible y sus metadatos Linux, pero no sustituye la revisión de ACL del servicio de archivos. No cambies `mountOptions`, la ACL, las claves ni la red como parte de esta corrección. Si la verificación revela que otras identidades o aplicaciones pueden leer el contenido, detén el despliegue y define el cambio de aislamiento para aprobación antes de publicar la nueva revisión.

La documentación de Microsoft indica que las aplicaciones y contenedores que montan la misma compartición pueden acceder a sus archivos, y que las opciones SMB `file_mode` y `dir_mode` afectan los modos visibles en Linux. Por eso este procedimiento verifica el uso de la compartición y sus ACL reales, sin tratar el argumento `mode` de Node como una garantía de aislamiento ([montajes de almacenamiento en Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/storage-mounts), [permisos SMB de Azure Files en Linux](https://learn.microsoft.com/en-us/azure/storage/files/storage-how-to-use-files-linux)).

## Despliegue manual

El push a `main` inicia la validación Docker y publica la imagen etiquetada con el SHA del commit en ACR; no actualiza por sí solo Azure Container Apps. Después de revisar el resultado del workflow y confirmar el acceso efectivo de Azure Files, actualiza manualmente la aplicación a la imagen exacta:

```sh
az containerapp update \
  --resource-group <GRUPO> \
  --name ca-gestiones-caillaux \
  --image acrgestionescaillaux-hwg9a5hvg7f6bxeu.azurecr.io/gestion-oficina:<SHA_DEL_COMMIT>
```

Comprueba que la nueva revisión inicia, que `/app/backups` aparece como montaje persistente y que el panel informa por separado el resultado local y Blob. La prueba manual crea una copia real de la base configurada; ejecútala solo durante la ventana operativa aprobada y confirma espacio disponible en Azure Files y Blob.

## Reversión

Si la nueva revisión falla, selecciona en Azure Container Apps la imagen/tag de la revisión anterior y vuelve a dirigir el tráfico a esa revisión. También puedes actualizar manualmente la imagen a su tag anterior:

```sh
az containerapp update \
  --resource-group <GRUPO> \
  --name ca-gestiones-caillaux \
  --image acrgestionescaillaux-hwg9a5hvg7f6bxeu.azurecr.io/gestion-oficina:<TAG_ANTERIOR>
```

La reversión no restaura ni modifica PostgreSQL, no borra archivos ni cambia el montaje. Los respaldos `.dump` nuevos permanecen en Azure Files y los ya verificados en Blob.

## Verificación realizada

Las pruebas del flujo usan directorios temporales, contenido sintético y dobles de pg_dump, pg_restore, el bloqueo PostgreSQL y Azure Blob. No se conectan a la base de producción ni a Azure y no leen los respaldos reales. `pg_restore --list` valida la estructura del archivo, pero no reemplaza una restauración de prueba aislada para certificar la recuperabilidad de cada base.
