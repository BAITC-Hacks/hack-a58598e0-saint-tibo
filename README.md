# Saint Tibo

Система автопротоколирования совещаний с фиксацией поручений для BAITC Hacks.
Целевой сценарий: запись → транскрипт с говорящими → поручения с ответственными
и сроками → саммари → протокол PDF/DOCX.

**Готова основа разработки:** вход и регистрация, проверка сессий и прав,
рабочее пространство RU/KK/EN, PostgreSQL с миграциями, типизированный
API-клиент и сборка. Загрузка записей, STT, диаризация, извлечение
поручений и экспорт ещё не реализованы.

Аудио и текст совещаний должны обрабатываться в закрытом контуре.
Внешние облачные API для этих данных запрещены условиями кейса.

## Запуск

Основной рабочий цикл — ручная проверка на личном dev-сервере, без CI/CD.
[Инструкция](docs/dev-server.md): `sh scripts/dev-deploy.sh saint-dev-danil`
(каждый использует свой сервер).

Для полного локального запуска нужны Git, Bun **1.4.2**, uv **0.12.13+**, Docker с Compose.
uv установит Python 3.13 по `backend/.python-version`.

```sh
git clone https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo.git
cd hack-a58598e0-saint-tibo
git switch dev
bun run setup
bun run dev
```

Открыть [приложение](http://localhost:3000), зарегистрироваться и войти.
[Swagger](http://localhost:8000/docs), readiness: `http://localhost:8000/health/ready`.
Регистрация создаёт обычного пользователя; права администратора выдаются отдельно.

`setup` устанавливает зависимости из lock-файлов, создаёт корневой `.env`
со случайным секретом, запускает PostgreSQL и применяет миграции.
Повторный запуск сохраняет секрет и данные. `Ctrl+C` останавливает приложения;
`bun run infra:stop` останавливает базу без удаления данных.

Для локальных демонстрационных аккаунтов: `bun run seed`.
Они создаются только этой командой: `admin@saint-tibo.local` и
`user@saint-tibo.local`, пароль `saint-tibo-dev` (переопределяется `SEED_PASSWORD`).
Не создавайте их на публичном сервере. Рабочие аккаунты создаются через регистрацию.

## Команды

| Команда из корня | Назначение |
| --- | --- |
| `bun run setup` | Зависимости, окружение, база, миграции |
| `bun run install:all` | Только зависимости из lock-файлов |
| `bun run dev` | База, миграции, API и frontend с перезагрузкой |
| `bun run build` | Production frontend и Python-пакет |
| `bun run verify` | Типы, существующие проверки, сборка |
| `bun run test:integration` | Авторизация и миграции в одноразовой БД Docker |
| `bun run api:generate` | OpenAPI → TypeScript SDK и Query helpers |
| `bun run migrate` | Drizzle для `auth`, Alembic для `app` |
| `bun run admin:grant <email>` | Выдать роль администратора локальному аккаунту |
| `bun run demo` / `demo:stop` | Собрать и запустить / остановить весь стек в Docker |

`demo` требует `.env`, подготовленный `setup`. Порты Compose привязаны
к loopback. Ручной серверный запуск добавляет Caddy с HTTPS и отдельное
окружение. Production: https://saint-tibo.win; адреса личных dev-серверов
и команды — в [инструкции](docs/dev-server.md).

## Структура

| Каталог | Ответственность |
| --- | --- |
| `frontend/` | React 19, TanStack Start, TypeScript 7, Tailwind, shadcn/Base UI |
| `backend/src/saint_tibo/` | FastAPI, авторизация, ошибки, health, предметные модули |
| `backend/migrations/` | SQLAlchemy/Alembic, прикладная схема `app` |
| `frontend/drizzle/auth/` | Better Auth/Drizzle, схема `auth` |
| `contracts/openapi.json` | Проверяемый снимок API |
| `tools/api-client/` | Изолированный генератор TypeScript-клиента |
| `build/stack-pin.json` | Стек и архитектурные решения |

Настройки — в корневом `.env`; образец — `.env.example`.
Для параллельных копий задавайте уникальные `COMPOSE_PROJECT_NAME`,
`POSTGRES_PORT`, `FRONTEND_PORT`, `BACKEND_PORT` и имя базы.

[Кейс и материалы](docs/case.md) · [Архитектура](docs/architecture.md) ·
[Командные ветки](docs/development.md) · [Соглашения](docs/conventions.md) ·
[Права доступа](docs/access-control.md) · [Ручной запуск на dev-сервере](docs/dev-server.md).
