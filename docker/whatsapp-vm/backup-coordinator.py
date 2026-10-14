import base64
import datetime
import email.utils
try:
    import fcntl
except ImportError:
    fcntl = None
import hashlib
import json
import os
import re
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ElementTree
from pathlib import Path

DATA_DIR = Path("/srv/whatsapp-data")
BACKUP_DIR = DATA_DIR / "profile-backups"
ENV_FILE = Path("/etc/whatsapp-worker/worker.env")
COMPOSE_FILE = Path("/opt/whatsapp-worker/compose.yaml")
PREFLIGHT = Path("/opt/whatsapp-worker/preflight.sh")
CONTROL_SOCKET = "/run/whatsapp-worker/maintenance.sock"
UPLOAD_STATE = Path("/var/lib/whatsapp-worker-backup/uploaded")
LOCK_FILE = "/run/whatsapp-worker-backup/backup.lock"
ACCOUNT_ENDPOINT = "https://stgestionescaillaux.blob.core.windows.net"
CONTAINER = "backups-whatsapp"
API_VERSION = "2023-11-03"
BLOCK_SIZE = 8 * 1024 * 1024
MAX_BACKUP_SIZE = 50 * 1024 ** 3
MAX_BLOCKS = 50_000


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


SIN_PROXY = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())


class BackupError(Exception):
    def __init__(self, reason, status=None, code=None, retryable=False):
        super().__init__(reason)
        self.reason = reason
        self.status = status
        self.code = code
        self.retryable = retryable


def log(event, **fields):
    print(json.dumps({"event": event, **fields}, separators=(",", ":")), flush=True)


def token_desde_imds():
    query = urllib.parse.urlencode({"api-version": "2018-02-01", "resource": "https://storage.azure.com/"})
    solicitud = urllib.request.Request(
        "http://169.254.169.254/metadata/identity/oauth2/token?" + query,
        headers={"Metadata": "true"},
    )
    try:
        with SIN_PROXY.open(solicitud, timeout=4) as respuesta:
            datos = json.loads(respuesta.read(65_536))
    except Exception as error:
        raise BackupError("managed_identity_unavailable", retryable=True) from error
    token = datos.get("access_token")
    if not isinstance(token, str) or not token:
        raise BackupError("managed_identity_unavailable", retryable=True)
    return token


class BlobUploader:
    def __init__(self, endpoint=ACCOUNT_ENDPOINT, container=CONTAINER, token_provider=token_desde_imds, opener=SIN_PROXY.open):
        self.endpoint = endpoint.rstrip("/")
        self.container = container
        self.token_provider = token_provider
        self.opener = opener
        self.token = None
        self.partes = urllib.parse.urlsplit(self.endpoint)
        if self.partes.scheme != "https" or not self.partes.hostname or self.partes.username or self.partes.password:
            raise BackupError("storage_endpoint_invalid")

    def _url(self, nombre, query=None):
        base = self.endpoint + "/" + urllib.parse.quote(self.container, safe="") + "/" + urllib.parse.quote(nombre, safe="")
        return base + ("?" + urllib.parse.urlencode(query) if query else "")

    def _request(self, method, nombre, data=None, headers=None, query=None, stream=False, intento_token=0):
        if self.token is None:
            self.token = self.token_provider()
        cabeceras = {
            "Authorization": "Bearer " + self.token,
            "x-ms-version": API_VERSION,
            "x-ms-date": email.utils.format_datetime(datetime.datetime.now(datetime.timezone.utc), usegmt=True),
        }
        cabeceras.update(headers or {})
        solicitud = urllib.request.Request(self._url(nombre, query), data=data, headers=cabeceras, method=method)
        try:
            return self.opener(solicitud, timeout=120 if method in ("GET", "PUT") else 20)
        except urllib.error.HTTPError as error:
            codigo = error.headers.get("x-ms-error-code", "")
            error.close()
            if error.code == 401 and intento_token == 0:
                self.token = None
                return self._request(method, nombre, data, headers, query, stream, 1)
            retryable = error.code in (408, 429, 500, 502, 503, 504)
            raise BackupError("storage_request_failed", error.code, codigo, retryable) from None
        except Exception as error:
            raise BackupError("storage_unreachable", retryable=True) from error

    def _head(self, nombre):
        try:
            response = self._request("HEAD", nombre)
            resultado = {"size": int(response.headers.get("Content-Length", "-1")),
                         "sha256": response.headers.get("x-ms-meta-sha256"),
                         "etag": response.headers.get("ETag")}
            response.close()
            return resultado
        except BackupError as error:
            if error.status == 404 and error.code == "BlobNotFound":
                return None
            raise

    def _verificar_remoto(self, nombre, expected_sha, expected_size):
        response = self._request("GET", nombre, stream=True)
        try:
            length = int(response.headers.get("Content-Length", "-1"))
            metadata = response.headers.get("x-ms-meta-sha256")
            etag = response.headers.get("ETag")
            actual = hashlib.sha256()
            descargado = 0
            while True:
                bloque = response.read(BLOCK_SIZE)
                if not bloque:
                    break
                actual.update(bloque)
                descargado += len(bloque)
        finally:
            response.close()
        digest = actual.hexdigest()
        if length != expected_size or descargado != expected_size or digest != expected_sha or metadata != expected_sha:
            raise BackupError("remote_content_mismatch", 409, "BackupIntegrityMismatch")
        return etag

    def _estado_bloques_no_confirmados(self, nombre, digest, size):
        response = self._request("GET", nombre, query={"comp": "blocklist", "blocklisttype": "uncommitted"})
        try:
            root = ElementTree.fromstring(response.read(2_000_000))
        finally:
            response.close()
        encontrados = {}
        bloques_esperados = (size + BLOCK_SIZE - 1) // BLOCK_SIZE
        for item in root.findall(".//UncommittedBlocks/Block"):
            encoded = item.findtext("Name") or ""
            try:
                bruto = base64.b64decode(encoded, validate=True).decode("ascii")
                prefix, indice = bruto.split(":", 1)
                indice = int(indice)
            except Exception:
                raise BackupError("remote_uncommitted_blocks_conflict", 409, "BlockIdMismatch") from None
            if prefix != digest[:32] or not 0 <= indice < bloques_esperados or indice in encontrados:
                raise BackupError("remote_uncommitted_blocks_conflict", 409, "BlockIdMismatch")
            size_esperado = min(BLOCK_SIZE, size - indice * BLOCK_SIZE)
            if int(item.findtext("Size", "-1")) != size_esperado:
                raise BackupError("remote_uncommitted_blocks_conflict", 409, "BlockSizeMismatch")
            encontrados[indice] = True
        return encontrados

    def _validar_placeholder(self, nombre, digest, size):
        bloques = self._estado_bloques_no_confirmados(nombre, digest, size)
        if not bloques:
            raise BackupError("remote_blob_conflict", 409, "BlobAlreadyExists")
        return bloques

    def _subir_bloques(self, archivo, nombre, digest, size, existentes):
        cantidad = (size + BLOCK_SIZE - 1) // BLOCK_SIZE
        if cantidad > MAX_BLOCKS:
            raise BackupError("backup_too_large")
        ids = []
        with archivo.open("rb") as fuente:
            for indice in range(cantidad):
                bruto = f"{digest[:32]}:{indice:016d}".encode("ascii")
                block_id = base64.b64encode(bruto).decode("ascii")
                ids.append(block_id)
                contenido = fuente.read(BLOCK_SIZE)
                if indice in existentes:
                    continue
                self._request("PUT", nombre, contenido, {
                    "Content-Type": "application/octet-stream",
                    "Content-Length": str(len(contenido)),
                }, {"comp": "block", "blockid": block_id})
        xml = "<BlockList>" + "".join(f"<Latest>{item}</Latest>" for item in ids) + "</BlockList>"
        try:
            self._request("PUT", nombre, xml.encode("ascii"), {
                "Content-Type": "application/xml",
                "If-None-Match": "*",
                "x-ms-meta-sha256": digest,
            }, {"comp": "blocklist"})
        except BackupError as error:
            if error.status in (409, 412):
                existente = self._head(nombre)
                if existente and existente["size"] == size and existente["sha256"] == digest:
                    self._verificar_remoto(nombre, digest, size)
                    return
            raise

    def upload_file(self, archivo):
        archivo = Path(archivo)
        stat = archivo.lstat()
        if not archivo.is_file() or archivo.is_symlink() or stat.st_size <= 0 or stat.st_size > MAX_BACKUP_SIZE:
            raise BackupError("local_backup_invalid")
        digest = hashlib.sha256()
        with archivo.open("rb") as fuente:
            for bloque in iter(lambda: fuente.read(BLOCK_SIZE), b""):
                digest.update(bloque)
        sha256 = digest.hexdigest()
        size = stat.st_size
        nombre = archivo.name
        existente = self._head(nombre)
        bloques_existentes = {}
        if existente:
            if existente["size"] == size and existente["sha256"] == sha256:
                etag = self._verificar_remoto(nombre, sha256, size)
                return {"sha256": sha256, "size": size, "etag": etag, "existia": True}
            if existente["size"] == 0 and not existente["sha256"]:
                bloques_existentes = self._validar_placeholder(nombre, sha256, size)
            else:
                raise BackupError("remote_blob_conflict", 409, "BlobAlreadyExists")
        try:
            if not existente or bloques_existentes:
                self._subir_bloques(archivo, nombre, sha256, size, bloques_existentes)
        except BackupError as error:
            if error.status in (409, 412):
                ya_existe = self._head(nombre)
                if ya_existe and ya_existe["size"] == size and ya_existe["sha256"] == sha256:
                    etag = self._verificar_remoto(nombre, sha256, size)
                    return {"sha256": sha256, "size": size, "etag": etag, "existia": True}
            raise
        etag = self._verificar_remoto(nombre, sha256, size)
        return {"sha256": sha256, "size": size, "etag": etag, "existia": False}


def _registrado(archivo, digest, size, uploader):
    marcador = UPLOAD_STATE / (archivo.name + ".json")
    try:
        datos = json.loads(marcador.read_text(encoding="utf-8"))
        if datos != {"name": archivo.name, "sha256": digest, "size": size, "etag": datos.get("etag")} or not isinstance(datos["etag"], str) or not datos["etag"]:
            return False
        remoto = uploader._head(archivo.name)
        return bool(remoto and remoto["size"] == size and remoto["sha256"] == digest and remoto["etag"] == datos["etag"])
    except Exception:
        return False


def _registrar(archivo, digest, size, etag):
    UPLOAD_STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    if UPLOAD_STATE.is_symlink():
        raise BackupError("upload_state_invalid")
    marcador = UPLOAD_STATE / (archivo.name + ".json")
    temporal = UPLOAD_STATE / ("." + archivo.name + "." + os.urandom(8).hex() + ".tmp")
    contenido = json.dumps({"name": archivo.name, "sha256": digest, "size": size, "etag": etag}, separators=(",", ":"))
    descriptor = os.open(temporal, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as salida:
            salida.write(contenido)
            salida.flush()
            os.fsync(salida.fileno())
        os.replace(temporal, marcador)
        if hasattr(os, "O_DIRECTORY"):
            descriptor_dir = os.open(UPLOAD_STATE, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(descriptor_dir)
            finally:
                os.close(descriptor_dir)
    finally:
        try:
            temporal.unlink()
        except FileNotFoundError:
            pass


def subir_pendientes(uploader=None):
    uploader = uploader or BlobUploader()
    errores = 0
    UPLOAD_STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    state_stat = UPLOAD_STATE.lstat()
    if not UPLOAD_STATE.is_dir() or UPLOAD_STATE.is_symlink() or state_stat.st_uid != 0:
        raise BackupError("upload_state_invalid")
    os.chmod(UPLOAD_STATE, 0o700)
    if BACKUP_DIR.is_symlink() or not BACKUP_DIR.is_dir():
        raise BackupError("backup_directory_invalid")
    for archivo in sorted(BACKUP_DIR.glob("*.wa-backup")):
        try:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9-]{36}\.wa-backup", archivo.name):
                raise BackupError("local_backup_invalid")
            stat = archivo.lstat()
            if not archivo.is_file() or archivo.is_symlink() or stat.st_size <= 0 or stat.st_size > MAX_BACKUP_SIZE:
                raise BackupError("local_backup_invalid")
            digest = hashlib.sha256()
            with archivo.open("rb") as fuente:
                for bloque in iter(lambda: fuente.read(BLOCK_SIZE), b""):
                    digest.update(bloque)
            size = archivo.stat().st_size
            sha256 = digest.hexdigest()
            if _registrado(archivo, sha256, size, uploader):
                log("blob_backup_previamente_verificado", archivo=archivo.name, bytes=size)
                continue
            error_final = None
            for intento in range(3):
                try:
                    resultado = uploader.upload_file(archivo)
                    _registrar(archivo, sha256, size, resultado["etag"])
                    log("blob_backup_verificado", archivo=archivo.name, bytes=resultado["size"], sha256=resultado["sha256"][:12], existente=resultado["existia"])
                    error_final = None
                    break
                except BackupError as error:
                    error_final = error
                    if not error.retryable or intento == 2:
                        break
                    time.sleep(2 ** (intento + 1))
            if error_final:
                errores += 1
                log("blob_backup_fallido", archivo=archivo.name, motivo=error_final.reason, status=error_final.status, codigo=error_final.code)
        except Exception:
            errores += 1
            log("blob_backup_fallido", archivo=archivo.name, motivo="local_backup_unavailable")
    return errores


def leer_configuracion():
    datos = {}
    for linea in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if not linea or linea.lstrip().startswith("#") or "=" not in linea:
            continue
        clave, valor = linea.split("=", 1)
        if clave in {"WHATSAPP_IMAGE", "WHATSAPP_DATA_UUID", "WHATSAPP_CLIENT_FINGERPRINTS", "WHATSAPP_MAX_SESSIONS", "WHATSAPP_REQUIRE_CAMPAIGN_LEASES"}:
            datos[clave] = valor
    if not datos.get("WHATSAPP_DATA_UUID") or datos.get("WHATSAPP_REQUIRE_CAMPAIGN_LEASES") != "true":
        raise BackupError("campaign_coordination_not_enabled")
    return datos


def comando(*argumentos, timeout=60, check=True, capture=True, env=None):
    resultado = subprocess.run(argumentos, timeout=timeout, check=False, text=True,
                               stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                               stderr=subprocess.PIPE if capture else subprocess.DEVNULL, env=env)
    if check and resultado.returncode != 0:
        raise BackupError("system_command_failed", resultado.returncode)
    return resultado


def servicio_activo():
    return subprocess.run(["systemctl", "is-active", "--quiet", "whatsapp-worker.service"], check=False).returncode == 0


def verificar_disco(config):
    mount = comando("findmnt", "--json", "--mountpoint", str(DATA_DIR), "--output", "TARGET,FSTYPE,UUID").stdout
    entradas = json.loads(mount)["filesystems"]
    if len(entradas) != 1 or entradas[0].get("target") != str(DATA_DIR) or entradas[0].get("fstype") != "ext4" or entradas[0].get("uuid") != config["WHATSAPP_DATA_UUID"]:
        raise BackupError("persistent_disk_not_verified")
    marcador = json.loads((DATA_DIR / ".crm-volume.json").read_text(encoding="utf-8"))
    if marcador.get("uuid") != config["WHATSAPP_DATA_UUID"] or not BACKUP_DIR.is_dir() or BACKUP_DIR.is_symlink():
        raise BackupError("persistent_disk_marker_invalid")


def control(op, timeout_ms=7_200_000):
    import socket
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
        sock.settimeout(5)
        sock.connect(CONTROL_SOCKET)
        sock.sendall((json.dumps({"op": op, "timeoutMs": timeout_ms}, separators=(",", ":")) + "\n").encode())
        if op == "prepare":
            sock.settimeout(timeout_ms / 1000 + 30)
        respuesta = bytearray()
        while len(respuesta) <= 4096:
            bloque = sock.recv(4097 - len(respuesta))
            if not bloque:
                break
            respuesta.extend(bloque)
            if b"\n" in bloque:
                break
        if len(respuesta) > 4096:
            raise BackupError("maintenance_control_invalid")
        datos = json.loads(bytes(respuesta).split(b"\n", 1)[0])
        if not isinstance(datos, dict):
            raise BackupError("maintenance_control_invalid")
        return datos


def liberar_compuerta():
    estado = control("status")
    if estado.get("mantenimiento") is not True:
        return
    if estado.get("campanasActivas") != 0 or estado.get("operacionesActivas") != 0:
        raise BackupError("maintenance_operations_active")
    resultado = control("abort")
    if resultado.get("ok") is not True or resultado.get("mantenimiento") is not False:
        raise BackupError("maintenance_gate_release_failed")


def esperar_salud(config, limite=180):
    compose = ["docker", "compose", "--env-file", str(ENV_FILE), "-f", str(COMPOSE_FILE)]
    fin = time.monotonic() + limite
    while time.monotonic() < fin:
        if servicio_activo():
            try:
                prueba = subprocess.run(compose + ["exec", "-T", "worker", "node", "/app/health.mjs"], check=False,
                                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)
                if prueba.returncode == 0:
                    return True
            except Exception:
                pass
        time.sleep(3)
    return False


def ejecutar_respaldo(config):
    compose = ["docker", "compose", "--profile", "maintenance", "--env-file", str(ENV_FILE), "-f", str(COMPOSE_FILE)]
    resultado = comando(*compose, "run", "--rm", "--no-deps", "--no-TTY", "backup", timeout=7_200)
    ultimo = next((linea for linea in reversed(resultado.stdout.splitlines()) if linea.startswith("{")), "")
    try:
        respaldo = json.loads(ultimo)
        nombre = Path(respaldo["archivo"]).name
        sha256 = respaldo["sha256"]
        if respaldo.get("copiaEnFrio") is not True or not nombre.endswith(".wa-backup") or not re_full_sha(sha256):
            raise ValueError()
    except Exception:
        raise BackupError("backup_result_invalid") from None
    log("respaldo_cifrado_creado", archivo=nombre, sha256=sha256[:12])


def re_full_sha(value):
    return isinstance(value, str) and len(value) == 64 and all(caracter in "0123456789abcdef" for caracter in value)


def ejecutar():
    if fcntl is None:
        log("mantenimiento_omitido", motivo="bloqueo_no_disponible")
        return 1
    descriptor_lock = os.open(LOCK_FILE, os.O_WRONLY | os.O_CREAT, 0o600)
    try:
        fcntl.flock(descriptor_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        log("respaldo_omitido", motivo="otra_ejecucion_activa")
        return 0
    estado = {"compuerta": False, "reiniciar": False, "detenido": False, "codigo": 0}
    config = None

    def terminar_por_senal(signum, frame):
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGTERM, terminar_por_senal)
    signal.signal(signal.SIGINT, terminar_por_senal)
    try:
        config = leer_configuracion()
        verificar_disco(config)
        entorno = os.environ.copy()
        entorno.update(config)
        comando("/bin/sh", str(PREFLIGHT), env=entorno)
        if not servicio_activo():
            raise BackupError("whatsapp_worker_not_active")
        compose = ["docker", "compose", "--env-file", str(ENV_FILE), "-f", str(COMPOSE_FILE)]
        salud = subprocess.run(compose + ["exec", "-T", "worker", "node", "/app/health.mjs"], check=False,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)
        if salud.returncode != 0:
            raise BackupError("whatsapp_worker_not_healthy")
        resultado = control("prepare")
        if resultado.get("ok") is not True:
            log("respaldo_omitido", motivo=resultado.get("motivo", "no_se_pudo_confirmar_inactividad"),
                campanas_activas=resultado.get("campanasActivas"), operaciones_activas=resultado.get("operacionesActivas"))
            return 0
        estado["compuerta"] = True
        estado["reiniciar"] = True
        log("mantenimiento_iniciado")
        detener = comando("systemctl", "stop", "whatsapp-worker.service", timeout=180, check=False)
        estado["detenido"] = not servicio_activo()
        if detener.returncode != 0 or not estado["detenido"]:
            raise BackupError("whatsapp_worker_stop_failed", detener.returncode)
        try:
            ejecutar_respaldo(config)
        except BackupError as error:
            estado["codigo"] = 1
            log("respaldo_cifrado_fallido", motivo=error.reason, status=error.status)
    except SystemExit as error:
        estado["codigo"] = int(error.code or 1)
        log("mantenimiento_interrumpido")
    except BackupError as error:
        estado["codigo"] = 1
        log("mantenimiento_fallido" if estado["reiniciar"] else "mantenimiento_omitido", motivo=error.reason, status=error.status, codigo=error.code)
    except Exception:
        estado["codigo"] = 1
        log("mantenimiento_fallido" if estado["reiniciar"] else "mantenimiento_omitido", motivo="verificacion_no_disponible")
    finally:
        if estado["compuerta"] and not estado["reiniciar"]:
            try:
                liberar_compuerta()
            except Exception:
                log("compuerta_no_liberada")
        if estado["reiniciar"]:
            try:
                reinicio = subprocess.run(["systemctl", "restart", "whatsapp-worker.service"], check=False,
                                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=180)
            except Exception:
                reinicio = None
            if reinicio is not None and reinicio.returncode == 0 and esperar_salud(config):
                try:
                    liberar_compuerta()
                    log("whatsapp_worker_reiniciado_y_verificado")
                except BackupError as error:
                    estado["codigo"] = 1
                    log("compuerta_no_liberada", motivo=error.reason)
            else:
                estado["codigo"] = 1
                log("whatsapp_worker_no_verificado")
        elif servicio_activo() and config:
            if esperar_salud(config, 30):
                log("whatsapp_worker_sin_cambios_y_saludable")
            else:
                estado["codigo"] = 1
                log("whatsapp_worker_no_verificado")
        if estado["reiniciar"] and servicio_activo():
            try:
                errores = subir_pendientes()
                if errores:
                    estado["codigo"] = 1
            except BackupError as error:
                estado["codigo"] = 1
                log("subida_azure_fallida", motivo=error.reason, status=error.status, codigo=error.code)
        os.close(descriptor_lock)
    return estado["codigo"]


def abortar_mantenimiento_manual():
    try:
        liberar_compuerta()
        log("compuerta_liberada_manualmente")
        return 0
    except BackupError as error:
        log("compuerta_no_liberada", motivo=error.reason, status=error.status, codigo=error.code)
        return 1


if __name__ == "__main__":
    if sys.argv[1:] == ["--abort-maintenance"]:
        sys.exit(abortar_mantenimiento_manual())
    if sys.argv[1:]:
        log("mantenimiento_omitido", motivo="argumento_invalido")
        sys.exit(2)
    sys.exit(ejecutar())
