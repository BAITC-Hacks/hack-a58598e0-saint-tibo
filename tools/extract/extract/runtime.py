"""One pinned CPU runtime per job; no resident model alongside STT."""

import hashlib
import socket
import subprocess
import time
from contextlib import contextmanager
from pathlib import Path

from extract.client import local_request
from extract.schema import ExtractionError

MODEL_ID = "Qwen/Qwen3-8B-GGUF"
MODEL_REVISION = "7c41481f57cb95916b40956ab2f0b139b296d974"
MODEL_SHA256 = "d98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785"
RUNTIME_ID = "llama.cpp-b11120"
BINARY_SHA256 = "ea63bf0b55fd178a9f9564447c6cf083f162eaa160c9a73643b7cb8b913d344c"


def fingerprint(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


@contextmanager
def local_runtime(binary: Path, model: Path):
    if not binary.is_file() or not model.is_file():
        raise ExtractionError("extraction_unavailable")
    if fingerprint(model) != MODEL_SHA256 or fingerprint(binary) != BINARY_SHA256:
        raise ExtractionError("extraction_bundle_mismatch")
    with socket.socket() as available:
        available.bind(("127.0.0.1", 0))
        port = available.getsockname()[1]
    server = subprocess.Popen([
        str(binary), "-m", str(model), "--host", "127.0.0.1", "--port", str(port),
        "-t", "4", "-c", "8192", "-np", "1", "-b", "256", "-ub", "128",
        "--no-repack", "--no-warmup", "--no-context-shift", "--offline",
        "--no-webui", "--log-disable", "--reasoning", "off",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}"
    try:
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            if server.poll() is not None:
                raise ExtractionError("extraction_runtime_failed")
            try:
                local_request(url, "/health", timeout=1)
                if server.poll() is not None:
                    raise ExtractionError("extraction_runtime_failed")
                break
            except ExtractionError:
                time.sleep(0.25)
        else:
            raise ExtractionError("extraction_start_timeout")
        yield url, server.pid
    finally:
        if server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
