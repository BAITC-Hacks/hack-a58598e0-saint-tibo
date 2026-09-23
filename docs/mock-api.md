# Локальный синтетический API для #83

Из третьего worktree `feat/85-mock-server`:

```sh
bun run mock:server
```

Это запускает **только** контейнер `mock-api` на `127.0.0.1:8015` (Compose
profile `mock`). Для полного UI, реальной локальной авторизации и backend:

```sh
bun run mock:dev
```

`mock:dev` на чистой копии создаёт отдельную `.env` для worktree (`saint_tibo_85`,
Postgres 5435, frontend 3005, backend 8005), выполняет обычный `setup`/миграции,
поднимает Postgres и mock в Docker, затем запускает backend и Vite. Откройте
`http://localhost:3005`, зарегистрируйте локального пользователя обычным способом.
Если `.env` уже есть, её настройки сохраняются. `python tools/mock-api/smoke.py` —
короткая автономная проверка без контейнера. Для ручного переключения в существующем
Vite процессе задайте `VITE_API_MODE=mock`, `VITE_MOCK_API_URL=http://localhost:8015`
и `BACKEND_INTERNAL_URL=http://localhost:8015`; `VITE_API_MODE=real` возвращает
обычный backend. После смены режима перезапустите Vite.

В мок перенаправляется только `/api/v1/meetings...`. Better Auth, сессия, выдача
JWT и `/api/v1/me` остаются настоящими. Browser-клиент посылает свой обычный
Bearer JWT; мок проверяет лишь наличие заголовка и никогда не читает БД. Контейнер
доступен только через loopback, требует отдельного profile и `MOCK_API_DEV_ONLY=1`.
Production-сборка с `VITE_API_MODE=mock` завершается ошибкой; runtime-переменные
не могут переключить уже собранный production bundle. Все ответные данные —
синтетические, `X-Saint-Tibo-Mock: synthetic`, `Cache-Control: no-store`.
Загруженные байты отбрасываются, запись для плеера генерируется из тона; никаких
пользовательских записей, текстов или токенов в фикстурах/логах нет. UI #83 должен
показывать видимую подпись «Синтетический пример» при `isMockApi`.

## Состояния и пути

| Путь / сценарий | Ответ | Контракт |
| --- | --- | --- |
| `GET /api/v1/meetings` | Шесть образцов, включая готовый, обработку, ошибки и неполную запись | #8/#9, OpenAPI `PageMeetingRead` |
| `GET /api/v1/meetings?scenario=empty` | `{items:[], total:0, limit:20, offset:0}` | #8/#9 |
| `?scenario=loading` / `?scenario=error` | Задержка 800 мс / 503 | Только управление UI-состоянием |
| `POST /meetings`, `GET/PATCH/DELETE /meetings/{id}` | Создание и редактирование в памяти | #8/#9, OpenAPI |
| `GET/POST/PATCH/DELETE /meetings/{id}/participants...` | Участники | #8/#9, OpenAPI |
| `GET/POST /meetings/{id}/recordings`, `GET/DELETE .../{recording_id}` | Метаданные записи | #8/#9, OpenAPI |
| `PUT .../file`, `PUT .../chunks/{sequence}`, `POST .../finalize` | Загрузка, неполная запись, ошибка `invalid_audio` у образца №3 | #8/#9, OpenAPI; байты не сохраняются |
| `GET/HEAD .../media` | Синтетический WAV 12 с, включая Range 206/416 | #9, OpenAPI; same-origin media proxy сохраняет настоящую cookie-проверку |
| `GET/POST .../jobs`, `GET .../jobs/{job_id}` | Очередь → обработка → успех; отдельные `running` и `failed` | #10, реализованный OpenAPI |
| `GET .../results`, `GET .../results/{result_version_id}`, `GET .../segments` | Версия STT и страницы реплик | #11, реализованный OpenAPI |
| `GET/PATCH /api/v1/meetings/{id}/review` | Реплики, говорящие, поручения, summary, revision/reviewed; 409 конфликт, 503 save failure | **DRAFT #12–13, не в production OpenAPI** |
| `GET /api/v1/meetings/{id}/export?format=pdf\|docx` | Синтетические файлы либо 503 export failure | **DRAFT #14, не в production OpenAPI** |

В списке: №1 — проверенный результат; №2 — processing; №3 — upload failure;
№4 — save failure; №5 — incomplete и failed job; №6 — unavailable export.
Для экранов пустого списка/ошибки/загрузки откройте страницу списка с
`?mock=empty`, `?mock=error` или `?mock=loading` и обновите её. Параметр
добавляется к запросу списка только при включённом `VITE_API_MODE=mock`.
Первый результат содержит `recording_id`, таймкоды 500–11500 мс, трёх
говорящих, троих участников, неизвестного говорящего, поручение Дане (не автору
реплики) со ссылками на два исходных сегмента, summary и `reviewed: true`.
Форма draft-поручения следует `docs/meeting-contract.md`:
`text, assignee_participant_id, assignee_text, due_text, due_date, status,
source_segment_ids`. Каждая строка summary имеет `{text,source_segment_ids}`.
Обновления draft проходят с `revision`; данные живут лишь
до перезапуска mock. Фикстуры и создаваемые ID повторяются после каждого старта.
Успех job на новом upload подставляет **только** этот синтетический review, а не
распознаёт присланное содержимое.

Production OpenAPI и generated SDK не содержат draft-операций. Когда #12–14
опубликуют реальные схемы, адаптер #83 должен перейти на них, а mock fixture —
следовать получившемуся контракту. Статусы записи и задания не смешиваются.
