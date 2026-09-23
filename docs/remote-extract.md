# Private GPU extraction

This opt-in transport keeps application validation, recording ownership, job
leases and database publication on the application host. A dedicated forced SSH
command receives the existing private extraction JSON request and returns its
existing single JSON envelope. It has no application or database credentials.
The STT runner, configuration and SSH key remain separate and unchanged.

## Wire and lifetime

Send one JSON header line with exactly `{"version":1,"bytes":N,"timeout":2000}`,
then exactly N bytes of UTF-8 JSON, then `.`/newline heartbeats every five seconds.
N must be 1–65536. The input must be a JSON object; the extraction driver performs
the existing segment/context validation. The runner ignores SSH commands and
accepts no client-selected paths, images, model, executable or container name.
Upload has a 300-second deadline and a 20-second stall limit.

The response is buffered until the container exits, bounded to 1 MiB and checked
as one JSON object with `status` equal to `ok` or `error`. There is no transcript
or response in Docker logs. The application still validates provenance and the
complete extraction schema before publication. Transport errors emit only
`{"status":"error","code":"extraction_failed"}` and return nonzero.

EOF, signals, absent heartbeat for 20 seconds, overflow and the 2000-second job
deadline all remove only that randomly named container and private job directory.
GNU timeout inside the container independently enforces 2000 seconds with a
five-second SIGKILL escalation. Client cancellation should close stdin and allow
12 seconds for cleanup before terminating SSH. Host crashes/SIGKILL can leave a
private directory; recover only verified stale jobs after their containers are
absent, never wipe the jobs/model tree.

## GPU image

Build on the existing GPU VM after the extraction CLI supports `--device cuda`:

```sh
docker build -f tools/extract/Dockerfile.cuda -t saint-tibo-extract-cuda:local .
docker image inspect saint-tibo-extract-cuda:local --format '{{.Id}}'
```

The base is the already prepared local immutable image
`sha256:a2c4f59e1bf1bac875e775eb952065750a33b8b3de619ca7cc0c95784b15d6c1`.
It contains the official [llama.cpp b11120 release](https://github.com/ggml-org/llama.cpp/releases/tag/b11120),
commit `08b1d2aea`, CUDA 12.8 x86_64 binaries and libraries, on Ubuntu 24.04
(`ubuntu@sha256:008173c23f95b170204355c12626cb5a965d779a7e1283b09e9cffbb1bf33ca3`).
The newer userspace is necessary for the official binary's GLIBC/GLIBCXX ABI;
the host itself is unchanged. Source archive SHA-256 pins are:

- `llama-b11120-bin-ubuntu-cuda-12.8-x64.tar.gz`:
  `add3be10f90f390deceba58791bf716c87b1265faefa39481470b1fb9fd4331e`.
- `cudart-llama-b11120-bin-ubuntu-cuda-12.8-x64.tar.gz`:
  `8a0ac718138f757c0921829e5a323c40220a725989087e465d7d0893ae512c37`.
- `/opt/llama/llama-server`:
  `a10f6bb5f53d90af6dbbcff5337acd68d4084e0592ed009164ae8efe47eac7b8`.

The GPU binary hash differs from the existing CPU hash. The driver's explicit
CUDA branch must verify it and request GPU layer offload; CPU remains the default.
The GGUF remains Qwen/Qwen3-8B-GGUF revision
`7c41481f57cb95916b40956ab2f0b139b296d974`, `Qwen3-8B-Q4_K_M.gguf` SHA-256
`d98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785`.
Only image/model preparation needs download access. The driver uses Python
stdlib; no package installer or model download runs during extraction.

## Host setup and SSH

Install a root-owned copy of `tools/extract/remote_runner.py` at
`/opt/saint-tibo/extract/remote_runner.py`. Use the existing dedicated `saint-stt`
execution account with Docker access, a separate account-owned mode-0700
`/srv/saint-tibo/extract-jobs`, and the existing root-owned, group-readable
`/srv/saint-tibo/models/qwen3-8b` (0750 directory, 0640 files).
Install root-owned `/etc/saint-tibo/extract-remote.json` with the newly built
extraction image ID, not the base image or a mutable tag:

```json
{
  "image": "sha256:REPLACE_WITH_THE_64_HEX_EXTRACTION_IMAGE_ID",
  "model_dir": "/srv/saint-tibo/models/qwen3-8b",
  "jobs_dir": "/srv/saint-tibo/extract-jobs"
}
```

Use a separate extraction SSH key, authenticated host-key pinning and the same
restricted application SSH egress route as STT. Install only its public key:

```text
restrict,from="VERIFIED_SSH_PEER_IP",command="/usr/bin/python3 -I /opt/saint-tibo/extract/remote_runner.py" ssh-ed25519 EXTRACTION_PUBLIC_KEY
```

If a provider SSH proxy is used, verify the actual peer through the authenticated
management channel; do not replace the source restriction with a wildcard.
Do not modify the STT key or expose an HTTP port. The container has network none,
read-only root/model/input, non-root execution, all capabilities dropped,
no-new-privileges, Docker logging disabled, 8 GiB RAM, four CPUs and bounded tmpfs.
The per-job llama-server binds only container loopback and ends with that job.

## Evidence boundary

The prepared base image has passed one synthetic CLI GPU extraction on L4:
1.785-second model load, 4.344-second container wall time, valid one-task JSON,
5276 MiB peak VRAM and 99% observed GPU utilization. That does not prove this
full driver/SSH path. Before enabling the application route, build the final
image and prove the actual existing schema/provenance, cancellation, heartbeat
expiry and removal of the job container/directory. Keep personal input/output
private; publish only counts, timings and provenance hashes.
