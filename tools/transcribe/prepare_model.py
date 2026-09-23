"""Explicit online preparation only; never called during an audio job."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import urllib.request

REVISION = "536b0662742c02347bc0e980a01041f333bce120"
MODEL_HASH = "3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671"
FILES = ("config.json", "tokenizer.json", "vocabulary.txt", "README.md", "model.bin")
BASE_URL = f"https://huggingface.co/Systran/faster-whisper-small/resolve/{REVISION}/"


def digest(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    args.destination.mkdir(parents=True, exist_ok=True)
    hashes = {}
    for name in FILES:
        target = args.destination / name
        if target.is_symlink():
            raise ValueError("Model path must not be a symlink")
        # Small metadata files are refreshed from the pinned revision; the large
        # file is reused only after verifying its published content hash.
        if name != "model.bin" or not target.is_file() or digest(target) != MODEL_HASH:
            temporary = target.with_suffix(target.suffix + ".download")
            with urllib.request.urlopen(BASE_URL + name, timeout=90) as response:
                with temporary.open("wb") as output:
                    while block := response.read(1024 * 1024):
                        output.write(block)
            if name == "model.bin" and digest(temporary) != MODEL_HASH:
                temporary.unlink()
                raise ValueError("Model checksum mismatch")
            temporary.chmod(0o644)
            os.replace(temporary, target)
        hashes[name] = digest(target)
        print(f"Prepared {name}", flush=True)
    manifest = {
        "model": "Systran/faster-whisper-small",
        "revision": REVISION,
        "license": "MIT",
        "sha256": hashes,
    }
    target = args.destination / "manifest.json"
    target.write_text(json.dumps(manifest, indent=2) + "\n")
    target.chmod(0o644)


if __name__ == "__main__":
    main()
