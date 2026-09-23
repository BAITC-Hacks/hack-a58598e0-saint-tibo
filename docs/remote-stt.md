# Private GPU speech recognition

This opt-in transport leaves PostgreSQL, job leases, ACLs, recording ownership,
result validation and publication on the existing application host. Only the
canonical WAV travels over pinned SSH to a dedicated NVIDIA VM. The remote
machine returns the existing private JSONL stream. It has no API/DB credentials,
public ASR port, recording identifiers or participant identities.

The default remains local CPU/int8. `BACKEND_STT_REMOTE_ENABLED=true` selects SSH
exclusively: connection, GPU or model failure fails the job, with no CPU fallback.
Both paths use faster-whisper **1.2.1**, CTranslate2 **4.8.2**, the existing lock,
and the same transcription settings, exact integer-ceil duration and model
identity/revision validator. CUDA uses explicit `device="cuda"` and `float16`;
available CUDA devices and supported compute types are checked before loading.
The prepared turbo bundle remains
`dropbox-dash/faster-whisper-large-v3-turbo` at
`0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf`.

## GPU image and host preparation

Only the deployment owner provisions the VM and runs these steps. Build from the
reviewed repository SHA on the GPU host:

```sh
docker build -f tools/transcribe/Dockerfile.cuda -t saint-tibo-stt-cuda:local .
docker image inspect saint-tibo-stt-cuda:local --format '{{.Id}}'
```

`Dockerfile.cuda` pins NVIDIA CUDA 12.8.1/Ubuntu 22.04 by manifest digest,
cuBLAS `12.8.4.1-1`, and cuDNN `9.10.2.21-1`. Python **3.13.14** is installed by
uv **0.12.13** in `/opt/python`; it is not Ubuntu's Python ABI. The original STT
lock is installed in `/opt/stt/.venv`. Only image construction and model
preparation need download access.

Install NVIDIA Container Toolkit/driver on the VM and confirm that Docker sees
the GPU. Prepare the existing pinned turbo bundle using
`tools/transcribe/prepare_model.py DESTINATION --model turbo`, or copy a prepared
bundle and let its existing checksum validator verify it. Keep it readable only
by the dedicated execution account/group and root; mount it read-only. No
automatic model download takes place at inference time.

Create a dedicated non-root `saint-stt` account, a root-owned copy of
`remote_runner.py` at `/opt/saint-tibo/stt/remote_runner.py`, and a private directory
`/srv/saint-tibo/stt-jobs` owned by that account (mode 0700). The account needs
permission to invoke Docker. Its SSH key must not grant an unrestricted shell.
Install root-owned `/etc/saint-tibo/stt-remote.json` containing:

```json
{
  "image": "sha256:REPLACE_WITH_THE_64_HEX_LOCAL_IMAGE_ID",
  "model_dir": "/srv/saint-tibo/models/turbo",
  "jobs_dir": "/srv/saint-tibo/stt-jobs"
}
```

The image ID is mandatory and immutable; tags and registry pulls are rejected.
The client cannot choose image, model, command, paths or container names. Do not
put private audio on the image build context or bake keys into an image.

## SSH and application settings

Generate a dedicated key for this transport. Obtain the VM host key through the
provider console/another authenticated channel and pin it in `known_hosts`;
unverified `ssh-keyscan` output alone is not host authentication. For a nondefault
port, pin `[IP]:PORT`. Install this shape of `authorized_keys` entry on the VM:

```text
restrict,from="APP_HOST_EGRESS_IP",command="/usr/bin/python3 -I /opt/saint-tibo/stt/remote_runner.py" ssh-ed25519 DEDICATED_PUBLIC_KEY saint-tibo-stt
```

The forced command ignores `SSH_ORIGINAL_COMMAND`. `restrict` disables PTY,
forwarding and user startup scripts. Limit inbound SSH in the VM firewall to the
application host and the deployment owner's management address. Do not publish
any other inference service or database.

The application worker runs as UID 10001. Its credential directory contains
`id_ed25519` (0600, readable by UID 10001) and `known_hosts`; mount it read-only.
Set these deployment values outside Git:

```dotenv
STT_REMOTE_HOST=VERIFIED_VM_IP
STT_REMOTE_USER=saint-stt
STT_REMOTE_PORT=22
STT_SSH_PATH=/private/saint-tibo-stt-ssh
```

After the required firewall and runtime proof, set `STT_REMOTE_ENABLED=true`
in the application host's deployment environment. The normal manual deployment
script then includes the remote override on every deployment. The default is
false; merely configuring a host or preparing credentials does not enable it.

The opt-in override enables only the processing worker:

```sh
docker compose -f compose.yaml -f tools/transcribe/compose.remote.yaml config --quiet
docker compose -f compose.yaml -f tools/transcribe/compose.remote.yaml up -d --build processing-worker
```

The override adds bridge `stt-ssh-egress`; the original `processing` network
remains internal. Before enabling it, the deployment owner must restrict this
bridge's outbound forwarding to the literal VM IP and SSH port using the host's
firewall. For a Docker iptables backend, the rule intent is:

```text
DOCKER-USER: incoming bridge stt-ssh-egress, destination VM_IP, TCP SSH_PORT → ACCEPT
DOCKER-USER: incoming bridge stt-ssh-egress, all other destinations → DROP
```

Place these before broad accept rules, preserve existing host rules, and apply
equivalent IPv6 restrictions if IPv6 is enabled. The bridge alone provides a
route, not an outbound allowlist. Use a literal IP so DNS access is unnecessary.
Prove allowed SSH and denied other egress from the worker before real audio.

The backend also supports explicit `BACKEND_STT_REMOTE_*` host, user, port,
identity-file, known-hosts-file and runner-path settings. SSH disables user config
and agent key discovery, requires strict host-key matching, uses batch mode and
bounded connect/keepalive timeouts. Disabling the override returns to the
unchanged local path; do not change routing midway through a running job.

## Lifetime and privacy

The stdin wire is one bounded JSON header, exactly that many WAV bytes, then
heartbeats every five seconds. Upload is bounded to 300 seconds with a 20-second
stall limit. The receiver verifies canonical PCM16 mono/16 kHz and the four-hour
limit before inference. The server creates a random 0700 job directory and
container name, independent of any client identifier.

The GPU container runs with no network, no capabilities, no Docker socket, a
read-only root filesystem, a read-only WAV/model, a limited tmpfs, and Docker
logging disabled. Stdout is only the private JSONL pipe; stderr is discarded.
Output buffering and aggregate output are bounded. No transcript is put in
container logs or persistent output files.

EOF, SIGHUP/TERM, invalid input, absent heartbeat for 20 seconds, output overflow
or the job timeout enter the same cleanup: `docker rm -f` for that generated
container, then removal of that generated directory only. Stopping the local SSH
process is not the cleanup mechanism. The backend first closes stdin and allows
12 seconds for remote cleanup; the remote watchdog covers a broken TCP link.
Inside the container, GNU `timeout` independently terminates inference at the
configured job limit (at most two hours), with SIGKILL escalation after five
seconds. This also bounds inference if the supervisor itself is killed. A host
crash or SIGKILL can leave a private job directory; deployment recovery must
inspect and remove stale directories only after verifying their containers are
absent. Never wipe the whole jobs/model tree as cancellation.

## Required deployment evidence

Build and inspect the CUDA image; inspect actual Python/package/CUDA versions,
GPU visibility and `float16` support on the provisioned VM. Then use a team-owned
fixture for one real app job and confirm actual model provenance, exact duration,
valid transcript and faster execution. While a second owned job runs, cancel it
and verify on the VM that both its container and private directory disappear.
Also prove disconnect/heartbeat expiration. Keep output private; report counts,
timings and safe identifiers, never transcript contents. Local transport or
model-import evidence does not constitute GPU inference or deployed proof.

Primary compatibility sources:

- [faster-whisper v1.2.1 GPU requirements and explicit float16](https://github.com/SYSTRAN/faster-whisper/blob/v1.2.1/README.md#gpu)
- [CTranslate2 v4.8.2 exact CUDA/cuBLAS/cuDNN image pins](https://github.com/OpenNMT/CTranslate2/blob/v4.8.2/docker/Dockerfile)
- [NVIDIA CUDA driver compatibility and its limitations](https://docs.nvidia.com/deploy/cuda-compatibility/minor-version-compatibility.html)
