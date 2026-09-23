# Локальная транскрипция

#11 подключает настоящий STT к заданиям #10. `target_stage=transcribe`:
успех означает сохранённый транскрипт с таймкодами, не готовое саммари,
поручения или подтверждённые личности говорящих.

## Запуск и модели

Отдельное окружение `tools/transcribe/uv.lock`: faster-whisper 1.2.1,
CTranslate2 4.8.2. Оно не устанавливается в окружение API. Worker запускает
отдельный процесс распознавания и останавливает его при timeout/потере lease.
На этом срезе один worker и одно задание одновременно, CPU INT8, 4 потока,
beam 5, без VAD и без word alignment. Паузы и шкала записи сохраняются.

Модель — [Systran/faster-whisper-small](https://huggingface.co/Systran/faster-whisper-small/tree/536b0662742c02347bc0e980a01041f333bce120),
MIT, revision `536b0662742c02347bc0e980a01041f333bce120`.
Подготовка выполняется явно до обработки и скачивает только модель:

```sh
python3 tools/transcribe/prepare_model.py /opt/saint-tibo/models/small
```

Для личного сервера можно выполнить тот же скрипт через SSH:
`ssh saint-dev-danil 'python3 - /opt/saint-tibo/models/small' < tools/transcribe/prepare_model.py`.
В серверном `.env` указать `STT_MODELS_PATH=/opt/saint-tibo/models`;
локально использовать `./models` и подготовить `./models/small`.
Скрипт сверяет SHA256 весов, сохраняет manifest и исходную карточку с лицензией.
Весов, токенизатора и промежуточных транскриптов в Git нет.

`processing-worker` подключён только к Docker-сети `processing` с `internal:true`,
где доступен PostgreSQL. Модели и аудио смонтированы read-only. Интернет,
frontend и внешний STT API при обработке не нужны. `local_files_only=True`
и offline-переменные дополнительно исключают автоматическое скачивание.
Образы собираются с сетью; выполнение происходит после подготовки без egress.

Вызов [faster-whisper](https://github.com/SYSTRAN/faster-whisper/tree/v1.2.1)
использует `task=transcribe`: перевод не выполняется. Режимы `ru`/`kk`
задают язык явно, `auto` определяет язык, `mixed` включает multilingual.
Само наличие этих режимов не доказывает качество KK и смешанной речи;
ручная оценка на соответствующих материалах остаётся в #11/#70.

## Версии и реплики

Задание публикует результат атомарно после полного завершения STT. Ошибка,
пустое распознавание, остановка, потеря lease или удаление записи не создают
успешную пустую версию. Новая обработка создаёт новый `ResultVersion`.
Версии в этом срезе только читаются: `status=draft`, `revision=1`,
`completed_stage=transcribe`. Исправления/саммари/поручения добавляются в #13.
`speaker_id=null` до диаризации #12.

Префикс: `/api/v1/meetings/{meeting_id}/recordings/{recording_id}`.

- `POST /jobs`: `request_key`, `language`, `target_stage=transcribe`,
  `allow_incomplete`, nullable `retry_of_job_id` → 202.
- Polling `GET /jobs/{job_id}`; при succeeded использовать `result_version_id`.
- `GET /results` → страницы версий, новые первыми.
- `GET /results/{result_version_id}` → происхождение, язык, длительность,
  число реплик, неполнота записи и готовый этап.
- `GET /results/{result_version_id}/segments` → страница реплик по времени.

Все ответы используют существующий JWT и owner ACL; чужой объект → 404.
У сегмента стабильный UUID, `recording_id`, `result_version_id`, nullable
`speaker_id`, текст и целые `start_ms`/`end_ms`. Плеер использует `start_ms`
на исходной записи. Если конечный токен модели выходит за EOF, только конец
сегмента обрезается по физической длительности. Некорректные интервалы отвергаются.
Удаление записи каскадно удаляет jobs, версии и реплики.

Транскрипт передаётся между процессами только через приватный pipe и хранится
в PostgreSQL. Логи worker содержат ID/статус/код ошибки; текст не выводится.
Частичные реплики не доступны как готовый результат. `progress` отражает
последний распознанный таймкод; загрузка модели имеет progress=null.
