"""Pinned local STT bundles; downloading runs only through the preparation CLI."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import urllib.request

MODELS = {
    "small": {
        "model": "Systran/faster-whisper-small",
        "revision": "536b0662742c02347bc0e980a01041f333bce120",
        "model_sha256": "3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671",
        "files": ("config.json", "tokenizer.json", "vocabulary.txt", "README.md", "model.bin"),
    },
    "turbo": {
        "model": "dropbox-dash/faster-whisper-large-v3-turbo",
        "revision": "0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf",
        "model_sha256": "e76620f83d5f5b69efd3d87e3dc180c1bd21df9fbebacfd4335e5e1efcc018da",
        "files": (
            "config.json",
            "preprocessor_config.json",
            "tokenizer.json",
            "vocabulary.json",
            "README.md",
            "model.bin",
        ),
    },
}


def digest(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def prepared_model(directory):
    manifest = json.loads((directory / "manifest.json").read_text())
    spec = next(
        (
            value for value in MODELS.values()
            if (manifest.get("model"), manifest.get("revision"))
            == (value["model"], value["revision"])
        ),
        None,
    )
    if spec is None:
        raise ValueError("Unknown model identity or revision")
    hashes = manifest.get("sha256", {})
    if hashes.get("model.bin") != spec["model_sha256"]:
        raise ValueError("Unexpected model checksum")
    for name in spec["files"]:
        path = directory / name
        if path.is_symlink() or not path.is_file() or digest(path) != hashes.get(name):
            raise ValueError("Incomplete or corrupted local bundle")
    return spec


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--model", choices=MODELS, default="small")
    args = parser.parse_args()
    spec = MODELS[args.model]
    base_url = f"https://huggingface.co/{spec['model']}/resolve/{spec['revision']}/"
    args.destination.mkdir(parents=True, exist_ok=True)
    args.destination.chmod(0o755)
    hashes = {}
    for name in spec["files"]:
        target = args.destination / name
        if target.is_symlink():
            raise ValueError("Model path must not be a symlink")
        # Small metadata files are refreshed from the pinned revision; the large
        # file is reused only after verifying its published content hash.
        if name != "model.bin" or not target.is_file() or digest(target) != spec["model_sha256"]:
            temporary = target.with_suffix(target.suffix + ".download")
            if temporary.is_symlink():
                raise ValueError("Download path must not be a symlink")
            with urllib.request.urlopen(base_url + name, timeout=90) as response:
                with temporary.open("wb") as output:
                    while block := response.read(1024 * 1024):
                        output.write(block)
            if name == "model.bin" and digest(temporary) != spec["model_sha256"]:
                temporary.unlink()
                raise ValueError("Model checksum mismatch")
            temporary.chmod(0o644)
            os.replace(temporary, target)
        target.chmod(0o644)
        hashes[name] = digest(target)
        print(f"Prepared {name}", flush=True)
    manifest = {
        "model": spec["model"],
        "revision": spec["revision"],
        "license": "MIT",
        "sha256": hashes,
    }
    target = args.destination / "manifest.json"
    if target.is_symlink():
        raise ValueError("Manifest path must not be a symlink")
    target.write_text(json.dumps(manifest, indent=2) + "\n")
    target.chmod(0o644)


if __name__ == "__main__":
    main()
