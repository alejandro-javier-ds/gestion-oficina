import os
import pathlib
import sys
import tarfile

archive, destination = sys.argv[1:]
allowed = {"whatsapp-sessions", "envios", "sesiones.json"}
with tarfile.open(archive, "r:") as source:
    members = []
    total = 0
    names = set()
    for member in source:
        total += member.size
        if len(members) >= 500000 or total > 50 * 1024 ** 3:
            raise ValueError("Archive too large")
        name = pathlib.PurePosixPath(member.name)
        if name.is_absolute() or not name.parts or name.parts[0] not in allowed or ".." in name.parts:
            raise ValueError("Invalid path")
        if not (member.isfile() or member.isdir()) or str(name) in names:
            raise ValueError("Invalid entry")
        names.add(str(name))
        member.mode = 0o700 if member.isdir() else 0o600
        member.uid = os.getuid() if hasattr(os, "getuid") else 0
        member.gid = os.getgid() if hasattr(os, "getgid") else 0
        member.uname = member.gname = ""
        member.pax_headers = {}
        members.append(member)
    for member in members:
        source.extract(member, destination, set_attrs=True)
        if member.isfile():
            with open(os.path.join(destination, member.name), "rb+") as saved:
                os.fsync(saved.fileno())
    if os.name != "nt":
        for root, _, _ in os.walk(destination, topdown=False):
            descriptor = os.open(root, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
