"""Forced SSH command: one private WAV in, bounded JSONL out, no public service."""

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
import wave

CONFIG = Path("/etc/saint-tibo/stt-remote.json")
MAX_AUDIO = 512 * 1024 * 1024
MAX_OUTPUT = 32 * 1024 * 1024
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
    container = "saint-stt-" + uuid4().hex
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
        if not isinstance(request, dict) or set(request) != {"version", "bytes", "language", "timeout"}:
            raise ValueError("Invalid request")
        size, language, timeout = request["bytes"], request["language"], request["timeout"]
        if (request["version"] != 1 or type(size) is not int or not 44 <= size <= MAX_AUDIO
                or language not in ("auto", "ru", "kk", "mixed")
                or type(timeout) is not int or not 10 <= timeout <= 7200):
            raise ValueError("Invalid request")
        directory = Path(tempfile.mkdtemp(prefix=container + "-", dir=jobs))
        audio = directory / "audio.wav"
        with audio.open("xb") as output:
            remaining = size
            while remaining:
                block = receive(min(65536, remaining), deadline)
                output.write(block)
                remaining -= len(block)
        with wave.open(str(audio), "rb") as source:
            if (source.getnchannels(), source.getsampwidth(), source.getframerate()) != (1, 2, 16000):
                raise ValueError("Expected canonical audio")
            if not 0 < source.getnframes() <= 16000 * 4 * 60 * 60:
                raise ValueError("Audio duration exceeded")
            remaining = source.getnframes() * 2
            while remaining:
                block = source.readframes(min(160000, remaining // 2))
                if not block or len(block) % 2:
                    raise ValueError("Truncated audio")
                remaining -= len(block)
        command = [
            docker, "run", "--rm", "--name", container, "--pull", "never",
            "--network", "none", "--gpus", "all", "--init", "--read-only",
            "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
            "--pids-limit", "256", "--memory", "8g", "--cpus", "4",
            "--log-driver", "none", "--user", f"{os.getuid()}:{os.getgid()}",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=256m",
            "--mount", f"type=bind,src={audio},dst=/input.wav,readonly",
            "--mount", f"type=bind,src={models},dst=/model,readonly",
            "--entrypoint", "/usr/bin/timeout", image,
            "--signal=TERM", "--kill-after=5s", str(timeout),
            "/opt/stt/.venv/bin/python", "/opt/stt/transcribe.py", "/input.wav",
            "--model-dir", "/model", "--language", language, "--device", "cuda",
        ]
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        assert process.stdout is not None
        os.set_blocking(1, False)
        pending = bytearray()
        received = 0
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
                        del pending[:count]
                    except BlockingIOError:
                        pass
                if output_eof and process.poll() is not None and not pending:
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
                        received += len(block)
                        pending.extend(block)
                        if received > MAX_OUTPUT or len(pending) > 256 * 1024:
                            raise ValueError("Output exceeded bounds")
    except Exception:
        try:
            os.write(1, b'{"event":"error","code":"transcription_failed"}\n')
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
