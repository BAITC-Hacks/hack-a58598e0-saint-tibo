"""Forced SSH command: one private JSON request in, one bounded JSON envelope out, no public service."""

import json
import os
from pathlib import Path
import re
import select
import selectors
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from uuid import uuid4

CONFIG = Path("/etc/saint-tibo/extract-remote.json")
MAX_INPUT = 65536
MAX_OUTPUT = 1024 * 1024
HEARTBEAT_SECONDS = 20


def receive(count, deadline):
    remaining = deadline - time.monotonic()
    if remaining <= 0 or not select.select([0], [], [], min(remaining, 20))[0]:
        raise TimeoutError("Upload stalled")
    block = os.read(0, count)
    if not block:
        raise EOFError("Client disconnected")
    return block


def stop_signal(signum, frame):
    raise InterruptedError("Session stopped")


def main():
    process = None
    directory = None
    output_started = False
    container = "saint-extract-" + uuid4().hex
    docker = "/usr/bin/docker"
    try:
        os.umask(0o077)
        for signum in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
            signal.signal(signum, stop_signal)
        config = json.loads(CONFIG.read_text())
        image = config["image"]
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", image):
            raise ValueError("Pin a locally built image ID")
        models = Path(config["model_dir"]).resolve(strict=True)
        jobs = Path(config["jobs_dir"]).resolve(strict=True)
        if not models.is_dir() or not jobs.is_dir() or models == jobs:
            raise ValueError("Invalid dedicated directories")
        deadline = time.monotonic() + 300
        header = bytearray()
        while not header.endswith(b"\n"):
            if len(header) >= 1024:
                raise ValueError("Header too large")
            header.extend(receive(1, deadline))
        request = json.loads(header)
        if not isinstance(request, dict) or set(request) != {"version", "bytes", "timeout"}:
            raise ValueError("Invalid request")
        size, timeout = request["bytes"], request["timeout"]
        if (type(request["version"]) is not int or request["version"] != 1
                or type(size) is not int or not 1 <= size <= MAX_INPUT
                or type(timeout) is not int or timeout != 2000):
            raise ValueError("Invalid request")
        directory = Path(tempfile.mkdtemp(prefix=container + "-", dir=jobs))
        transcript = directory / "input.json"
        payload = bytearray()
        while len(payload) < size:
            payload.extend(receive(size - len(payload), deadline))
        if not isinstance(json.loads(payload), dict):
            raise ValueError("Expected a JSON object")
        with transcript.open("xb") as output:
            output.write(payload)
        command = [
            docker, "run", "--rm", "--name", container, "--pull", "never",
            "--network", "none", "--gpus", "all", "--init", "--read-only",
            "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
            "--pids-limit", "256", "--memory", "8g", "--cpus", "4",
            "--log-driver", "none", "--user", f"{os.getuid()}:{os.getgid()}",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=256m",
            "--mount", f"type=bind,src={transcript},dst=/input.json,readonly",
            "--mount", f"type=bind,src={models},dst=/model,readonly",
            "--entrypoint", "/usr/bin/timeout", image,
            "--signal=TERM", "--kill-after=5s", str(timeout),
            "/usr/bin/python3", "/opt/extract/run.py", "--transcript", "/input.json",
            "--llama-server", "/opt/llama/llama-server",
            "--model-file", "/model/Qwen3-8B-Q4_K_M.gguf", "--device", "cuda",
        ]
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        assert process.stdout is not None
        os.set_blocking(1, False)
        pending = bytearray()
        response = bytearray()
        validated = False
        heartbeat = time.monotonic()
        deadline = heartbeat + timeout
        output_eof = False
        with selectors.DefaultSelector() as selector:
            selector.register(0, selectors.EVENT_READ, "heartbeat")
            selector.register(process.stdout, selectors.EVENT_READ, "output")
            while True:
                now = time.monotonic()
                if now >= deadline or now - heartbeat > HEARTBEAT_SECONDS:
                    raise TimeoutError("Remote job expired")
                if pending:
                    try:
                        count = os.write(1, pending)
                        output_started = output_started or count > 0
                        del pending[:count]
                    except BlockingIOError:
                        pass
                if output_eof and process.poll() is not None:
                    if not validated:
                        envelope = json.loads(response)
                        if not isinstance(envelope, dict) or envelope.get("status") not in ("ok", "error"):
                            raise ValueError("Invalid extraction envelope")
                        pending.extend(response)
                        validated = True
                    elif not pending:
                        return 0 if process.returncode == 0 else 1
                for key, _ in selector.select(timeout=0.1):
                    if key.data == "heartbeat":
                        block = os.read(0, 1024)
                        if not block:
                            raise EOFError("Client disconnected")
                        if any(char not in (46, 10) for char in block):
                            raise ValueError("Invalid heartbeat")
                        heartbeat = time.monotonic()
                    else:
                        block = os.read(process.stdout.fileno(), 65536)
                        if not block:
                            selector.unregister(process.stdout)
                            output_eof = True
                        response.extend(block)
                        if len(response) > MAX_OUTPUT:
                            raise ValueError("Output exceeded bounds")
    except Exception:
        try:
            if not output_started:
                os.write(1, b'{"status":"error","code":"extraction_failed"}\n')
        except OSError:
            pass
        return 1
    finally:
        # No user-supplied ID/path participates in deletion. Docker's name is a
        # fresh server UUID, and mkdtemp created the only directory removed here.
        for signum in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
            signal.signal(signum, signal.SIG_IGN)
        if process is not None:
            try:
                subprocess.run([docker, "rm", "-f", container], check=False, timeout=10,
                               stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL)
            except (OSError, subprocess.TimeoutExpired):
                pass  # Container also has its independent hard timeout.
            if process.poll() is None:
                process.kill()
            process.wait()
        if directory is not None:
            shutil.rmtree(directory)


if __name__ == "__main__":
    sys.exit(main())
