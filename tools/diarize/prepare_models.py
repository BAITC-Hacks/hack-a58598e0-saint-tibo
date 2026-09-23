"""Explicit online preparation of public artifacts; never run during an audio job."""

import argparse
import json
import os
from pathlib import Path
import tarfile
import tempfile
import urllib.request

from bundle import FILES, MANIFEST, SEGMENTATION_ARCHIVE, verified, verify_bundle


def download(spec: dict, target: Path) -> None:
    with urllib.request.urlopen(spec["url"], timeout=90) as response, target.open("xb") as output:
        remaining = spec["size"]
        while block := response.read(min(1024 * 1024, remaining + 1)):
            if len(block) > remaining:
                raise ValueError("Artifact exceeded pinned size")
            output.write(block)
            remaining -= len(block)
    if not verified(target, spec):
        raise ValueError("Artifact checksum mismatch")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    destination = parser.parse_args().destination
    destination.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix=".diarize-", dir=destination) as temporary:
            staging = Path(temporary)
            archive_path = staging / "segmentation.tar.bz2"
            for name, spec in FILES.items():
                target = destination / name
                if target.is_symlink():
                    raise ValueError("Refusing a symlink target")
                if verified(target, spec):
                    continue
                prepared = staging / name
                if "member" in spec:
                    if not archive_path.exists():
                        download(SEGMENTATION_ARCHIVE, archive_path)
                    # Read only named, sized regular members; never extract archive paths.
                    with tarfile.open(archive_path) as archive:
                        member = archive.getmember(spec["member"])
                        if not member.isfile() or member.size != spec["size"]:
                            raise ValueError("Unexpected archive member")
                        source = archive.extractfile(member)
                        if source is None:
                            raise ValueError("Missing archive member")
                        with source, prepared.open("xb") as output:
                            output.write(source.read(spec["size"] + 1))
                    if not verified(prepared, spec):
                        raise ValueError("Archive member checksum mismatch")
                else:
                    download(spec, prepared)
                prepared.chmod(0o644)
                os.replace(prepared, target)
                print(f"Prepared {name}", flush=True)
            manifest = staging / "manifest.json"
            manifest.write_text(json.dumps(MANIFEST, indent=2) + "\n")
            manifest.chmod(0o644)
            if (destination / "manifest.json").is_symlink():
                raise ValueError("Refusing a symlink manifest")
            os.replace(manifest, destination / "manifest.json")
        verify_bundle(destination)
        print("Diarization bundle verified", flush=True)
        return 0
    except Exception:
        print("Diarization model preparation failed", flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
