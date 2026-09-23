# Backend

FastAPI · SQLAlchemy async · Alembic. Запуск и проверки — из [корня](../README.md).
Swagger: `http://localhost:8000/docs`. Настройки читаются из корневого `.env`.

- `api/` — HTTP router, health checks.
- `modules/` — прикладные домены; пока не реализованы.
- `auth/` — JWT, сессии, [права доступа](../docs/access-control.md).
- `core/` — настройки, ошибки, логирование.

Порядок действий для нового домена — в [соглашениях](../docs/conventions.md).
Alembic владеет только `app`; сгенерированная ревизия форматируется автоматически:

```sh
uv run alembic revision --autogenerate -m "add projects"
uv run alembic upgrade head
```

`uv run alembic check` показывает расхождение моделей и миграций.
После изменения API — `bun run api:generate` из корня. Запись завершать явным
`await session.commit()`; общая сессия уже открыла транзакцию при проверке auth.
