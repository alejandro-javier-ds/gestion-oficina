# WhatsApp Masivo: selección y seguimiento

Esta mejora se aplica a Gestiones y PDPs. El navegador, el visor, los perfiles,
la VM y la comunicación mTLS existentes siguen siendo los responsables de
vincular WhatsApp y enviar los mensajes. No hay cambios de infraestructura.

## Uso

1. Elige el tipo de campaña, el periodo, la cartera y el número de salida.
2. Marca explícitamente los celulares que quieras utilizar. Seleccionar un
   cliente no selecciona sus teléfonos. Cada celular activo y válido aparece
   una vez, incluso si estaba registrado también con el prefijo `+51`.
3. Puedes marcar uno, varios o todos los disponibles. Agregar un celular manual
   válido lo selecciona expresamente para ese cliente; no modifica su ficha.
4. Pulsa **Preparar envío**. La revisión muestra los destinos elegidos y permite
   cambiar teléfonos y mensajes antes de confirmar. Preparar abre un borrador
   de revisión; la selección se guarda al confirmar.
5. Un administrador o supervisor puede confirmar el envío. Un gestor puede
   guardar la selección de su cartera, conservando sus permisos actuales.
6. Elige una campaña en **Campaña en seguimiento** para ver sus resultados.
   **Revisar selección guardada** recupera sus destinatarios preparados y texto.
   La campaña seleccionada se conserva en la URL al recargar.

La selección parte vacía. La opción **Seleccionar solo teléfonos pendientes**
elige los pendientes del listado y filtros actuales. No selecciona automáticamente
los enviados, fallidos ni los resultados inciertos. Los fallidos se eligen
manualmente y requieren autorizar su reintento durante la revisión.

## Estados y evidencia

| Estado del cliente | Significado en la campaña elegida |
| --- | --- |
| COMPLETADO, verde | Todos los celulares activos y válidos tienen éxito registrado. |
| PARCIAL, amarillo | Hay éxitos y quedan teléfonos sin éxito. |
| PENDIENTE, gris | No hay éxitos registrados. Un cliente sin celulares permanece pendiente. |
| REVISAR, rojo | Hay fallos o resultados inciertos que requieren atención. |

El contador `2/4 enviados · 2 pendientes` corresponde al cliente, incluyendo los
celulares manuales incorporados a esa campaña. Un manual retirado antes de
procesarse no aumenta el denominador. Si cambia la cartera o sus teléfonos
activos, el contador se recalcula con la información vigente.

Cada teléfono muestra pendiente, enviado, fallido, en proceso o **Verificar
resultado**, junto con el último intento, la campaña y el remitente cuando
existen. Un borrador no inventa una fecha de intento. El estado de la campaña
describe su lote seleccionado: un lote de dos destinos puede terminar enviado
y dejar al cliente parcial si tiene cuatro celulares activos.

**Enviado** significa que el mecanismo de envío existente confirmó la operación.
No acredita entrega, lectura ni gestión de cobranza. Estas mejoras no generan
gestiones ni promesas de pago a partir de los mensajes.

Los filtros son Todos, Completados, Parciales, Pendientes, Con errores y Números
sin envío exitoso. El historial del cliente tiene vistas independientes de
historial general y campaña elegida, paginadas a 50 registros.

## Persistencia, reintentos y concurrencia

Se reutilizan `whatsapp_campanas`, `whatsapp_campana_destinatarios`, `cuentas` y
`telefonos`. **No se requiere migración, tabla, columna ni cambio de PostgreSQL.**
No se ejecutó SQL contra la base real durante la implementación o las pruebas.

- Cada par IDC/celular seleccionado obtiene su propio destinatario. Se normalizan
  los celulares peruanos sin truncar entradas inválidas y se eliminan duplicados.
- Una selección guardada puede editar solamente sus preparados aún sin intento.
  Retirarlos usa `EXCLUIDO`; no borra filas. Los intentos procesados se conservan.
- Un fallo conocido requiere confirmación y crea una fila nueva al reintentar.
  El error, fecha y evidencia anteriores permanecen en el historial. El nuevo
  intento recibe su propio identificador de envío; los reintentos técnicos del
  mismo intento conservan la idempotencia del worker existente.
- Un éxito bloquea el reenvío dentro de esa campaña. Una campaña posterior exige
  confirmación explícita de seguimiento cuando hubo éxito previo.
- Un resultado incierto no se marca enviado ni se reintenta dentro de la misma
  campaña. Un seguimiento posterior exige verificar WhatsApp y confirmar que el
  intento anterior no se realizó. No hay comprobación automática de entrega.
- Se conserva el bloqueo por remitente y la reclamación transaccional de campañas.
  Los destinatarios se leen dentro de esa reclamación. Una versión de selección
  impide sobrescribir desde otra ventana o enviar una selección distinta de la
  revisada. Las confirmaciones se validan otra vez al reclamar el envío.
- Antes de cada operación se vuelven a verificar usuario, permisos, cartera,
  cliente activo y teléfono. Las consultas usan respuestas privadas sin caché.

## Compatibilidad y operación

Los registros anteriores se leen sin modificarlos. Para determinar el avance se
agrupan por IDC y número normalizado; varios registros antiguos de éxito para
el mismo celular no aumentan el contador. El historial conserva esos registros.
Un envío anterior no completa una campaña nueva.

Las pestañas antiguas deben recargarse: guardar y enviar exigen el nuevo contrato
de selección explícita y versión de revisión. Esto evita que un frontend antiguo
prepare o envíe todos los celulares de manera implícita. Si hay tráfico entre
revisiones antiguas y nuevas, la operación puede rechazarse; revisa el historial
y vuelve a abrir la selección, sin repetir automáticamente el envío.

Si una interrupción deja una campaña `ENVIANDO`, se mantiene su bloqueo. Los
intentos sin confirmación aparecen para verificar. Esta mejora no libera ese
bloqueo automáticamente ni deduce que el mensaje no salió: requiere revisión
operativa antes de un desbloqueo o seguimiento.

El historial general de la interfaz está paginado. Los resúmenes de clientes
consultan sus intentos anteriores para detectar éxitos y resultados inciertos;
conviene medir su coste cuando ese historial crezca. No se añadieron índices ni
se cambió la configuración de la base de producción.

## Archivos

| Grupo | Archivos modificados o agregados |
| --- | --- |
| Página y PDP | `app/admin/whatsapp/page.tsx`, `components/whatsapp/PestanaPdpWhatsapp.tsx` |
| API existente | `app/api/whatsapp/clientes/route.ts`, `pdps/route.ts`, `historial/route.ts`, `enviar/route.ts`, `progreso/route.ts` |
| API nueva | `app/api/whatsapp/seguimiento/route.ts` |
| Selección y revisión | `components/whatsapp/FilaClienteWhatsapp.tsx`, `TablaClientesWhatsapp.tsx`, `TablaClientesPdpWhatsapp.tsx`, `ModalClientesWhatsapp.tsx`, `RevisionEnvioWhatsapp.tsx`, `SeleccionTelefonosWhatsapp.tsx` |
| Seguimiento visual | `components/whatsapp/ControlSeguimientoWhatsapp.tsx`, `SeguimientoClienteWhatsapp.tsx` |
| Hooks | `hooks/useWhatsappCampana.ts`, `useWhatsappClientes.ts`, `useWhatsappSeleccion.ts`, `useWhatsappTelefonos.ts` |
| Backend y modelo | `lib/whatsapp/preparacion.ts`, `campanas.ts`, `seguimiento.ts` |
| Documentación | `README.md`, este documento |

Las pruebas y las capturas sintéticas permanecen en `tests/`, ignoradas por Git
y excluidas de Docker según la política local del proyecto. No se cambiaron los
ignores, paquetes, secretos, certificados, Docker, backups ni configuración Azure.

## Validación local

Resultado del 14 de octubre de 2026: **160/160 pruebas automatizadas aprobadas**,
**6/6 escenarios en Chrome aprobados**, TypeScript e imagen Docker correctos.
El lint de los archivos afectados terminó sin errores y con dos advertencias
preexistentes por contadores locales sin uso en la ruta de envío.

Se verifican estas capas por separado:

- 125 regresiones existentes de lógica, importación, transacciones, seguridad,
  backups Blob, visor y autorización WhatsApp.
- 18 pruebas nuevas del modelo: un celular, dos de cuatro, todos, manuales,
  normalización, duplicados, estados, filtros y resultados inciertos.
- 17 pruebas nuevas contra PostgreSQL 18 descartable: rutas protegidas, cartera,
  selección exacta, mensajes editados, concurrencia, versiones obsoletas,
  reintentos autorizados, compatibilidad e historial. Incluyen reiniciar esa
  base y comprobar que la evidencia permanece.
- Seis escenarios en Chrome contra la imagen Docker y datos sintéticos: selección,
  revisión editable, recuperación, parcial/completado, reinicio de la aplicación,
  PDP con dólares y revisión a 390 px. El endpoint de envío se bloquea antes de
  llegar al servidor; los éxitos del escenario visual son fixtures de prueba.
- TypeScript, lint de archivos afectados y compilación de la imagen de producción.

Los tests locales del modelo se ejecutan con:

```powershell
node --import tsx --test tests/whatsapp-seleccion.test.ts
```

Las pruebas de PostgreSQL crean y retiran únicamente sus propios contenedores y
volúmenes, con nombres y etiquetas de validación. No leen `.env.local` ni usan
los perfiles reales:

```powershell
node tests/whatsapp-seleccion-native.mjs
docker build -t gestion-oficina:whatsapp-seleccion-validation .
$env:CRM_WHATSAPP_UI = '1'
node tests/whatsapp-seleccion-native.mjs
Remove-Item Env:CRM_WHATSAPP_UI
```

El escenario visual usa Chrome de Windows y registra un operador y clientes
sintéticos exclusivamente en la base descartable. No vincula celulares reales,
no usa credenciales Azure ni ejecuta campañas reales.

## Verificación antes de producción

1. Usa un entorno de prueba aislado y recarga el navegador con el frontend nuevo.
2. Selecciona un cliente de cuatro celulares y marca dos. Abre la revisión y
   comprueba que solo aparecen esos destinos; modifica uno y el mensaje.
3. Confirma la selección con el envío bloqueado o simulado en ese entorno y
   comprueba en su historial que quedaron exactamente los destinos elegidos.
4. Abre nuevamente la campaña, recupera el borrador y verifica los datos tras
   reiniciar la aplicación de prueba.
5. Comprueba parcial, completado, filtros, permisos de gestor y separación de
   historial. Verifica que no se marque entrega ni lectura sin evidencia.
6. Solo después de autorización expresa, realiza un envío real controlado con
   un destino de prueba para validar la VM y WhatsApp. Las pruebas de este cambio
   no certifican envíos reales en producción.

Publicar el commit no cambia por sí mismo la revisión de Container Apps.
El despliegue de la imagen CRM requiere aprobación manual y no necesita cambios
de VM, mTLS, volúmenes, horarios o migraciones. No se desplegó automáticamente.
