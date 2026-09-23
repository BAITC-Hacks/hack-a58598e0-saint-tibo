from saint_tibo.core.config import Settings


def test_backend_commands_use_root_env(tmp_path, monkeypatch):
    backend = tmp_path / "backend"
    backend.mkdir()
    (tmp_path / ".env").write_text(
        "BACKEND_DATABASE_URL=postgresql+asyncpg://test:test@localhost:5544/test\n"
    )
    monkeypatch.chdir(backend)
    monkeypatch.delenv("BACKEND_DATABASE_URL", raising=False)
    assert Settings().database_url.hosts()[0]["port"] == 5544
    monkeypatch.setenv("BACKEND_DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5566/test")
    assert Settings().database_url.hosts()[0]["port"] == 5566
