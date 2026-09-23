# Фоновая обработка

Срез #10 хранит очередь и историю попыток в PostgreSQL. Отдельный
`processing-worker` получает задания через `FOR UPDATE SKIP LOCKED`;
HTTP не запускает обработку и не ждёт её завершения. Новый сервис запускается
обычным ручным deploy вместе с профилем `app`. Дополнительной очереди нет.

## API

Префикс: `/api/v1/meetings/{meeting_id}/recordings/{recording_id}/jobs`.
Все запросы требуют существующий Bearer JWT и владельца совещания.

- `POST` → 202, `createProcessingJob`.
- `GET` → страница `{items,total,limit,offset}`, `listProcessingJobs`.
- `GET /{job_id}` → `getProcessingJob`.

```json
{
  "request_key": "b9e74b70-aeba-4b61-a0f9-29a7559ba5a0",
  "language": "auto",
  "allow_incomplete": false,
  "retry_of_job_id": null
}
```

Клиент создаёт `request_key` один раз при нажатии и сохраняет для сетевых
повторов. Тот же ключ и параметры возвращают тот же job с текущим состоянием;
изменённые параметры → 409 `idempotency_conflict`. Другой ключ при активном
задании → 409 `processing_in_progress`. Новая попытка требует новый ключ;
`retry_of_job_id` может ссылаться только на failed/interrupted этой записи.
Попытки не перезаписываются, `attempt` растёт внутри записи.

Обрабатывать можно только ready или воспроизводимый incomplete с явным
`allow_incomplete:true`. Языки: `auto`, `ru`, `kk`, `mixed`.
Polling — каждые 2 секунды при queued/running, с паузой при скрытой вкладке.
`progress` — nullable доля выполнения текущего этапа, не счётчик времени.

## Worker и восстановление

Worker проверяет каноническое WAV из #9 блоками, не загружая всё аудио в RAM.
Декодирование исходного файла уже выполнено #9 с явным первым аудиопотоком;
выбор другой дорожки ещё не реализован.

#11 подключает локальную транскрипцию: `target_stage=transcribe`, успешный job
ссылается на новую версию транскрипта. Это ещё не поручения и не саммари.
Подготовка модели и чтение реплик — в [transcription.md](transcription.md).
Отсутствующая модель/ошибка STT завершают попытку с явным кодом ошибки.

Worker продлевает lease раз в 20 секунд (по умолчанию lease 60 секунд).
Просроченное running переводится в interrupted при следующем polling или
проходе worker. После SIGTERM сохраняется `interrupted / worker_stopped`;
после аварии — `interrupted / worker_lease_expired`. Автоматических повторов нет.
Токен владения и lease проверяются при каждой записи состояния: старый worker
не может завершить удалённое или уже прерванное задание.
Максимум времени одной попытки — 2 часа, затем `failed / processing_timeout`.

Удаление записи каскадно удаляет её задания. Worker монтирует запись read-only;
не создаёт файлов после удаления. Логи содержат ID, этап/статус и код ошибки,
без текста совещания, имени файла, SQL-параметров и stderr библиотек.

Локальный запуск worker из backend с настроенным `.env`:
`uv run --no-dev python -m saint_tibo.modules.processing.worker`.
