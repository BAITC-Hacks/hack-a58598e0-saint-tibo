# Соглашения

Решения, принятые один раз, чтобы не принимать их заново в каждой фиче.
## Новая доменная фича — порядок действий

1. `backend/src/saint_tibo/modules/<domain>/`: `models.py`, `schemas.py`, `service.py`, `router.py`.
2. Права: добавить `Permission` и выдать ролям в `auth/policy.py`.
3. Подключить router в `api/router.py`, импортировать модели в `migrations/env.py`.
4. `uv run --directory backend alembic revision --autogenerate -m "add <domain>"`,
   затем `bun run migrate`. Миграция форматируется автоматически (post-write hooks).
5. `bun run api:generate` — контракт и типизированный клиент.
6. Frontend: страница в `src/pages/<slice>/`, тонкий роут в `src/app/routes/`,
   пункт в массиве `navigation` в `app-shell.tsx`.
7. Строки: `bun run --cwd frontend i18n:add <key> "<ru>" "<kk>" "<en>"`.
8. `bun run fix && bun run check && bun run test`.

Проверить вручную: `bun run token` выдаёт JWT, `bun run seed` — локальные аккаунты.

## Backend

| Решение | Как |
| --- | --- |
| Первичный ключ | `UUIDPrimaryKey` из `db/mixins.py` (uuid4, `gen_random_uuid()` на стороне БД) |
| Владелец записи | `OwnedByUser` (`owner_id`, индекс). FK на `auth` нет: схемой владеет Drizzle |
| Время | `Timestamps` (`created_at`/`updated_at`, `timestamptz`, `now()`) |
| Список | `Page[T]` + `Pagination` + `paginate()` из `core/pagination.py` |
| Ответы | Наследуйте `ReadModel` (`from_attributes=True`) |
| PATCH | Наследуйте `PartialUpdate`, перечислите `NON_NULLABLE`, пишите через `.changes()` |
| Ошибки | `APIError(status, code, message)`; коды в snake_case (`not_found`) |
| Коды ответов | `201` на create, `204` на delete, `responses={401,403,404}` в декораторе |
| Именование полей | snake_case и в JSON, и в Python. Клиент генерируется как есть |
| operation_id | camelCase глагол + сущность: `listMeetings`, `createMeeting` |
| Транзакция | Auth уже открыл её. Пишущий сервис завершает `await session.commit()` |

Слоя репозитория нет: `AsyncSession` уже реализует Unit of Work, а обёртка из
однострочных методов была бы лишней. Сервис — модуль с функциями, а не класс.
Формат ошибок — собственный конверт `{"error": {...}}`, а не RFC 9457
problem+json: он даёт один типизированный `ErrorResponse` в сгенерированном
клиенте вместо набора необязательных полей.

Ограничение прав — только в HTTP-слое (`require_permissions`), проверка владельца —
всегда в SQL-запросе, а не после выборки. Чужая запись возвращает `404`, не `403`.

**`strict=True` нельзя ставить на входной DTO.** Строгий режим отклоняет JSON-строку
для enum-поля и отвечает 422 на корректный запрос. На ответных моделях он безопасен.

## Frontend

| Решение | Как |
| --- | --- |
| Слои FSD | Только `app`, `pages`, `shared`. `entities`/`features`/`widgets` — если переиспользуется 2+ раз |
| Данные | Сгенерированные `*Options` / `*Mutation` + `backendClient` |
| Инвалидация | `invalidateResource(queryClient, "<tag>")` — тег операции из OpenAPI |
| Кеш и сессии | `AuthCacheBoundary` чистит кеш при logout и смене сессии. Ключи вручную не скоупить |
| Загрузка данных | `loader: ensureQueryData(...)` в роуте + `useSuspenseQuery(...)` в компоненте |
| Формы | `react-hook-form` + `zodResolver`, поля через `Field`/`FieldLabel`/`FieldError` |
| Переводы | `useLocale()` + `m.key(inputs, { locale })` в render; `changeLocale()` меняет cookie без reload и потери форм. `m.key()` без locale — для обработчиков вне React |
| Ошибки мутаций | Глобальный toast из `MutationCache`. Свой `onError` отключает его |
| Ошибки запросов | `RouteError`; `AccessDeniedError` рисует отдельный экран 403 |
| Компоненты | `bun run --cwd frontend ui:add <name>` (Base UI, реестр `base-vega`) |
| Серверный код | Только `*.server.ts`, импорт через `index.server.ts` слайса |

`src/shared/ui/shadcn/**` — вендор: не редактируется, исключён из линтера и форматтера.
`src/shared/api/generated/**`, `routeTree.gen.ts`, `src/shared/lib/i18n/**` — генерируются.

## Окружение

Единственный источник настроек — корневой `.env`. Значения по умолчанию в коде
отсутствуют намеренно: пропущенная переменная должна падать, а не молча подключаться
к другой базе.

Команды фронтенда из корня запускаются как `bun --env-file=../.env run --cwd frontend …`
(путь к `.env` резолвится относительно `--cwd`). Из корня без `--cwd` — `--env-file=.env`.

Параллельные worktree: свои `FRONTEND_PORT`/`BACKEND_PORT`, своя база в
`AUTH_DATABASE_URL`/`BACKEND_DATABASE_URL` и свой `COMPOSE_PROJECT_NAME`.
Cookie-сессия изолируется автоматически — префикс включает порт.

`TEST_DATABASE_URL` указывает только на одноразовую базу: интеграционные тесты
выполняют `alembic downgrade base` и стирают схему `app`.
