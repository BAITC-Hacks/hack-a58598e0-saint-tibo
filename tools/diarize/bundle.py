"""Pinned public model artifacts; no network access from the inference process."""

import hashlib
import json
from pathlib import Path

BUNDLE_ID = "saint-tibo-diarization-v1"
RELEASES = "https://github.com/k2-fsa/sherpa-onnx/releases/download/"
SEGMENTATION_ARCHIVE = {
    "url": RELEASES + "speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2",
    "asset_id": 197666131,
    "size": 6958444,
    "sha256": "24615ee884c897d9d2ba09bb4d30da6bb1b15e685065962db5b02e76e4996488",
}
ARCHIVE_PREFIX = "sherpa-onnx-pyannote-segmentation-3-0/"
FILES = {
    "segmentation.onnx": {
        "member": ARCHIVE_PREFIX + "model.onnx",
        "size": 5992913,
        "sha256": "220ad67ca923bef2fa91f2390c786097bf305bceb5e261d4af67b38e938e1079",
    },
    "segmentation.LICENSE": {
        "member": ARCHIVE_PREFIX + "LICENSE",
        "size": 1061,
        "sha256": "14d7016ad68e7394d6e6b78d96cc2ae431c905287b89674cfdf021e79e62b8ba",
    },
    "segmentation.README.md": {
        "member": ARCHIVE_PREFIX + "README.md",
        "size": 115,
        "sha256": "0380ed76a50efcc421dc62f251ed06e8349688466beac3177bee6e00dc336bfc",
    },
    "embedding.onnx": {
        "url": RELEASES + "speaker-recongition-models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx",
        "asset_id": 198893098,
        "size": 39593761,
        "sha256": "1a331345f04805badbb495c775a6ddffcdd1a732567d5ec8b3d5749e3c7a5e4b",
    },
    "embedding.LICENSE": {
        "url": "https://raw.githubusercontent.com/modelscope/3D-Speaker/065629c313eaf1a01c65c640c46d77e61e9607b4/LICENSE",
        "size": 11357,
        "sha256": "c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4",
    },
    "runtime.LICENSE": {
        "url": "https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/11afbd009a7f8c08f4bcf2fc1b265d0df4670fbf/LICENSE",
        "size": 11358,
        "sha256": "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30",
    },
}
MANIFEST = {
    "schema_version": 1,
    "bundle_id": BUNDLE_ID,
    "runtime": {"sherpa-onnx": "1.13.8", "sherpa-onnx-core": "1.13.8", "numpy": "2.5.3"},
    "segmentation": {"model": "pyannote/segmentation-3.0", "license": "MIT"},
    "embedding": {
        "model": "iic/speech_eres2net_base_sv_zh-cn_3dspeaker_16k",
        "license": "Apache-2.0",
    },
    "segmentation_archive": SEGMENTATION_ARCHIVE,
    "files": FILES,
}


def verified(path: Path, spec: dict) -> bool:
    if path.is_symlink() or not path.is_file() or path.stat().st_size != spec["size"]:
        return False
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest() == spec["sha256"]


def verify_bundle(directory: Path) -> None:
    manifest_path = directory / "manifest.json"
    if manifest_path.is_symlink() or manifest_path.stat().st_size > 16384:
        raise ValueError("Invalid bundle manifest")
    if json.loads(manifest_path.read_text()) != MANIFEST:
        raise ValueError("Unexpected bundle provenance")
    if not all(verified(directory / name, spec) for name, spec in FILES.items()):
        raise ValueError("Model bundle checksum mismatch")
