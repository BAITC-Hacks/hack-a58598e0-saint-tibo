from pathlib import Path

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_prefix="BACKEND_", extra="ignore")

    # No default: a missing BACKEND_DATABASE_URL must fail loudly instead of
    # silently connecting to another database.
    database_url: PostgresDsn
    cors_origins: list[str] = ["http://localhost:3000"]
    auth_jwks_url: str = "http://localhost:3000/api/auth/jwks"
    auth_issuer: str = "http://localhost:3000"
    auth_audience: str = "saint_tibo-api"
    jwks_cache_seconds: int = Field(default=300, ge=1)
    jwks_refresh_cooldown_seconds: int = Field(default=5, ge=1)
    http_timeout_seconds: float = Field(default=5, gt=0)
    database_timeout_seconds: float = Field(default=5, gt=0)
    log_level: str = "INFO"
    honcho_url: str | None = None
    honcho_jwt_secret: str | None = None

    recording_storage_path: Path = Path("../.data/recordings")
    recording_max_bytes: int = Field(default=512 * 1024 * 1024, ge=1)
    recording_chunk_max_bytes: int = Field(default=8 * 1024 * 1024, ge=1)
    recording_max_chunks: int = Field(default=4096, ge=1)
    recording_max_duration_ms: int = Field(default=4 * 60 * 60 * 1000, ge=1)
    recording_upload_timeout_seconds: float = Field(default=600, gt=0)
    recording_media_timeout_seconds: float = Field(default=600, gt=0)
    recording_stale_seconds: int = Field(default=15 * 60, ge=1)

    processing_lease_seconds: int = Field(default=60, ge=15, le=600)
    processing_timeout_seconds: int = Field(default=2 * 60 * 60, ge=10)
    stt_python_path: Path = Path("/app/stt/.venv/bin/python")
    stt_script_path: Path = Path("/app/stt/transcribe.py")
    stt_model_path: Path = Path("/models/small")

    extract_script_path: Path = Path("/app/extract/run.py")
    extract_runtime_path: Path = Path("/llama/llama-server")
    extract_model_path: Path = Path("/extract-model/Qwen3-8B-Q4_K_M.gguf")
    extract_remote_enabled: bool = False
    extract_remote_identity_file: Path = Path("/run/stt-ssh/extract_ed25519")
    extract_remote_runner_path: str = Field(
        default="/opt/saint-tibo/extract/remote_runner.py", pattern=r"^/[A-Za-z0-9_./-]+$"
    )
    diarization_python_path: Path = Path("/app/diarize/.venv/bin/python")
    diarization_script_path: Path = Path("/app/diarize/diarize.py")
    diarization_model_path: Path = Path("/models/diarization-v1")

    stt_remote_enabled: bool = False
    stt_remote_host: str = Field(default="", pattern=r"^[A-Za-z0-9.:-]*$")
    stt_remote_user: str = Field(default="saint-stt", pattern=r"^[a-z_][a-z0-9_-]*$")
    stt_remote_port: int = Field(default=22, ge=1, le=65535)
    stt_remote_identity_file: Path = Path("/run/stt-ssh/id_ed25519")
    stt_remote_known_hosts_file: Path = Path("/run/stt-ssh/known_hosts")
    stt_remote_runner_path: str = Field(
        default="/opt/saint-tibo/stt/remote_runner.py", pattern=r"^/[A-Za-z0-9_./-]+$"
    )
