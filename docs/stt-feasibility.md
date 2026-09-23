# Локальный STT: подготовка к #11

Проверено 23 сентября 2026 года. Это решение для первого benchmark,
а не поставленная функция STT и не основание закрывать
[#11](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/11).
Предметная интеграция зависит от #10. Runtime, lock-файлы и серверы
этой работой не изменены. Ограничения данных — в [кейсе](case.md).

## Решение и доказательства

Первый CPU baseline: multilingual `Systran/faster-whisper-small`,
`faster-whisper`, CTranslate2, `device=cpu`, `compute_type=int8`,
4 потока, один одновременно обрабатываемый файл. Это предложение
для измерения; production-модель выбираем после RU/KK/mixed сравнения.
STT исполняется отдельным worker-процессом, вне FastAPI/uvicorn.

| Что | Статус |
| --- | --- |
| `saint-dev-danil`, read-only SSH | AMD x86-64, 8 vCPU, AVX2, Linux 7.0.0-27-generic |
| Память во время осмотра | 15 986 MiB всего, 14 939 MiB available, swap отсутствует |
| Диск `/opt/saint-tibo` | 302 GiB свободно; это снимок, не резерв под модель |
| STT на этом сервере | Не запускался; сервер нужен параллельному deploy |
| Локальные прогоны кейса на Mac | Ранее выполнены MLX Whisper base/small; не являются измерением Linux CPU и KK |
| RU/KK/mixed точность, Linux RTF/RSS, egress isolation | Ещё не проверены |

### Локальный прогон на Apple M5 Max, 23 сентября 2026

Отдельное окружение Python 3.13.15 в игнорируемом `.data/stt/venv`:
`faster-whisper==1.2.1`, `ctranslate2==4.8.2`, CPU INT8, 4 потока,
beam 5, без VAD. Публичный bundle small взят по revision
`536b0662742c02347bc0e980a01041f333bce120`; SHA256 `model.bin`:
`3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671`.
Обе записи декодированы локально через PyAV с явным выбором аудиопотока
в PCM16/16 kHz/mono WAV. Аудио и транскрипты никуда не отправлялись.

| Запись | Длительность | Язык auto | Inference / RTF | Пик RSS | Сегменты / ошибки границ |
| --- | ---: | --- | ---: | ---: | ---: |
| №1 | 274,250 с | `ru` | 32,326 с / 0,1179 | 1 315 848 192 B | 77 / 0 |
| №2 | 206,031 с | `ru` | 26,901 с / 0,1306 | 1 271 463 936 B | 82 / 0 |

Все сегменты имеют непустой текст, допустимые границы и неубывающие
начала. Это структурная проверка, **не** оценка точности речи: дословного
эталона и ручной языковой проверки пока нет. WER/CER не рассчитаны;
эти результаты не оценивают KK или переключение RU/KK и не заменяют
Linux benchmark для #11. Метрики, транскрипты, WAV и полный список
версий находятся только в игнорируемом `.data/stt/` с режимом файлов
0600. SHA256 исходных MP3: №1
`0f18f11a6f65f9a2bad6497f387b224c775885a03a811edf3fb15c5238db6f54`,
№2 `b7a42833d0691b99af300a24c7dcdeaf05378355633fb867ef6bfc9e2a8f8f46`.

На macOS прогон выполнялся через `sandbox-exec` с профилем
`(version 1) (allow default) (deny network*)`. Контрольное TCP-подключение
из того же профиля вернуло `PermissionError` (`errno 1`); это внешняя
проверка сетевой границы, а поле CLI `network_isolation_verified`
остаётся `false`. Повторный запуск на уже подготовленном WAV и bundle:

```sh
umask 077
sandbox-exec -p '(version 1) (allow default) (deny network*)' \
  .data/stt/venv/bin/python scripts/benchmark-stt.py \
  .data/stt/wav/meeting-1.wav --model-dir .data/stt/models/small \
  --model-revision 536b0662742c02347bc0e980a01041f333bce120 \
  --language auto --threads 4 --beam-size 5 \
  --output .data/stt/results/meeting-1-auto-repeat.json \
  --transcript-output .data/stt/results/meeting-1-auto-repeat-transcript.json
```

Для №2 заменить `meeting-1` на `meeting-2`; каждый output обязан быть
новым файлом. Для KK/mixed проверки нужны 60–120 секунд записанной
носителем речи каждого сценария и дословный проверенный эталон с
казахскими буквами, числами, датами и переключениями языка.

## Кандидаты из первичных источников

| Кандидат | Проверяемые факты | Роль в сравнении |
| --- | --- | --- |
| [SYSTRAN small](https://huggingface.co/Systran/faster-whisper-small) | MIT; multilingual, в списке есть `ru` и `kk`; готовый CT2 `model.bin` 483 546 902 байт, плюс tokenizer/config/vocabulary | Дешёвый CPU baseline; языковой токен не доказывает качество |
| [Kazakh Whisper Large-v3 Turbo](https://huggingface.co/shyngys879/kazakh-whisper-large-v3-turbo) автора Shyngys Sovetkhan | Автор указывает Apache-2.0; полный Transformers checkpoint, около 0.8B параметров, `model.safetensors` 1 617 824 864 байт; основан на OpenAI Turbo | Второй кандидат, если small теряет казахские слова; требует конвертации в CT2 и собственного измерения |

В карточке KK-кандидата приведены авторские FLEURS WER 11,80% против
70,45% у small. Это чужое измерение на другом корпусе; его нельзя объявлять
нашим результатом. Карточка отдельно перечисляет code-switching RU/KK
как ограничение. GPU-скорость из неё не переносится на наш AMD CPU.
Для честного сравнения влияния fine-tuning можно дополнительно проверить
[исходный OpenAI Turbo](https://huggingface.co/openai/whisper-large-v3-turbo):
MIT, уменьшенный с 32 до 4 слоёв decoder; CPU-преимущество здесь не измерено.
Сохранять notice исходной модели и лицензию выбранных весов вместе с bundle.

[Upstream benchmark faster-whisper](https://github.com/SYSTRAN/faster-whisper#benchmark)
на 13 минутах аудио и Intel i7-12700K, 8 потоков: small INT8,
beam 5 — 102 секунды и 1477 MB RAM. Это ориентир, не SLA нашего VM.
Batch 8 использовал больше RAM; первый прогон делаем последовательно.
[CTranslate2](https://opennmt.net/CTranslate2/quantization.html) поддерживает
INT8 CPU; FP16 на таком CPU преобразуется в FP32. Проверять
`get_supported_compute_types("cpu")` в фактическом окружении.

Доступные на дату исследования выпуски:
[faster-whisper 1.2.1](https://github.com/SYSTRAN/faster-whisper/releases/tag/v1.2.1),
[CTranslate2 4.8.2](https://opennmt.net/CTranslate2/installation.html).
Это кандидаты для отдельного benchmark-env, не новые project pins.
Перед интеграцией зафиксировать полный `uv.lock` worker-окружения и
подтвердить Python 3.13/wheels на целевом Linux. Не добавлять torch/STT
в API-окружение ради запуска эксперимента.

## Подготовка без материалов совещания

Проверенные source revisions из API Hugging Face:

- small: `536b0662742c02347bc0e980a01041f333bce120`;
- KK Turbo: `dafae810c95496f66184605824be5a0a971d3c09`.

Сначала на отдельной машине подготовки установить выбранное окружение,
скачать веса и сохранить manifest с SHA256 всех файлов, версиями библиотек,
source revision и лицензиями. Следующий пример скачивает только small;
не загружает аудио/тексты никуда. Команды здесь подготовлены, не выполнены.

```sh
STT_ENV=/opt/saint-stt-benchmark
uv venv --python 3.13 "$STT_ENV"
uv pip install --python "$STT_ENV/bin/python" \
  faster-whisper==1.2.1 ctranslate2==4.8.2
uv pip freeze --python "$STT_ENV/bin/python" > "$STT_ENV/resolved.txt"
"$STT_ENV/bin/python" - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id="Systran/faster-whisper-small",
    revision="536b0662742c02347bc0e980a01041f333bce120",
    local_dir="/opt/saint-stt-models/small",
    allow_patterns=["model.bin", "config.json", "tokenizer.json", "vocabulary.txt", "README.md"],
)
PY
```

`resolved.txt` фиксирует эксперимент, но не заменяет lock с hashes для
интеграции. Runtime и транзитивные wheels тоже должны быть подготовлены
до отключения сети. Для чистого повторного запуска нужны локальный
model bundle, tokenizer и VAD asset, входная WAV и установленные библиотеки.
Нельзя передавать `WhisperModel("small")`: это alias с автоматической
загрузкой. Отсутствующий `tokenizer.json` также может вызвать обращение
к Hub; CLI отклоняет неполный локальный bundle.
[Поведение загрузки](https://github.com/SYSTRAN/faster-whisper/blob/v1.2.1/faster_whisper/transcribe.py),
[revision/download API](https://huggingface.co/docs/huggingface_hub/guides/download).

KK-кандидата готовить только при необходимости: скачать pinned
Transformers snapshot, конвертировать локальным
[`ct2-transformers-converter`](https://opennmt.net/CTranslate2/guides/transformers.html#whisper)
`--model <local-snapshot> --output_dir <local-ct2> --quantization int8 --copy_files tokenizer.json preprocessor_config.json`,
сохранить revision исходника и SHA256 конвертированного bundle.
Конверсия и её потребление памяти ещё не проверены; не делать её
одновременно с deploy на общем dev-сервере. Промежуточные веса требуют
дополнительного диска и RAM. Никакой модели по сети во время job.

## Воспроизводимый прогон

[CLI](../scripts/benchmark-stt.py) использует stdlib и уже установленный
optional `faster-whisper`. Он ничего не устанавливает и не скачивает.
Вход — готовая PCM16/16kHz/mono WAV. Исходные MP3 кейса имеют PNG-обложку,
поэтому декодировать явно первый **аудио**-поток, сохранив оригинал:

```sh
umask 077
ffmpeg -nostdin -v error -i /private/input.mp3 -map 0:a:0 \
  -vn -ac 1 -ar 16000 -c:a pcm_s16le /private/ru.wav
```

На Linux запускать в отдельном network namespace без сети.
[`unshare --net`](https://github.com/util-linux/util-linux/blob/master/sys-utils/unshare.1.adoc)
требует соответствующего права; это не изменение firewall сервера.
Вызов ниже после создания namespace возвращает uid/gid текущего оператора.
Каталог результатов заранее создать закрытым и доступным этому оператору.

```sh
sudo unshare --net --setgid "$(id -g)" --setuid "$(id -u)" \
  /opt/saint-stt-benchmark/bin/python scripts/benchmark-stt.py \
  /private/ru.wav --model-dir /opt/saint-stt-models/small \
  --model-revision 536b0662742c02347bc0e980a01041f333bce120 \
  --language ru --threads 4 --beam-size 5 \
  --output /private/results/ru-small-run1.json \
  --transcript-output /private/results/ru-small-run1-transcript.json
```

В контейнерном worker эквивалентная граница —
[`docker run --network none`](https://docs.docker.com/engine/network/drivers/none/)
с заранее собранным образом и read-only mount моделей/аудио. Не монтировать
Docker socket. Подтвердить isolation отдельно: внутри того же namespace
нет внешнего интерфейса/маршрута, попытка сетевого подключения не проходит,
после этого реальное распознавание завершается. Одни
[`HF_HUB_OFFLINE=1`](https://huggingface.co/docs/huggingface_hub/package_reference/environment_variables#hfhuboffline)
и `local_files_only=True` не являются доказательством блокировки egress.
CLI честно оставляет `network_isolation_verified=false`; внешнее
доказательство записать рядом с результатом, не исправлять метрику вручную.

Повторить для `--language kk` и `--language mixed`, на каждом образце
два новых процесса: первый и повторный запуск. `mixed` включает
`multilingual=True`; `auto` определяет язык без этого режима. Сравнить
mixed с auto на той же записи: смена языка внутри 30-секундного окна
может оставаться ошибочной. Не использовать `task=translate`.

CLI считает время загрузки отдельно от полного прохода lazy-итератора,
RTF = inference / duration, process peak RSS, SHA256 WAV/model файлов,
версии библиотек и число некорректных границ. Hashing до измерения
разогревает файловый cache: это **не cold-disk latency**. RSS — пик всего
процесса, не только модели. Сначала 4 потока; 8 сравнивать в свободное
окно, следя за API. VAD по умолчанию выключен; повтор с `--vad` нужен
для проверки потерь тихой речи и пауз. Beam 1 сравнивать с beam 5 только
при ручной проверке чисел/имён/сроков. Одновременно jobs не запускать.

Результат stdout не содержит транскрипта, имён файлов и текста ошибок
библиотек. Опциональный transcript JSON создаётся с mode 0600 и содержит
текст; хранить вне репозитория и общей телеметрии. CLI не перезаписывает
существующие файлы. Он не рассчитывает WER без человеческого эталона.

## Реплики и таймкоды для #8/#12/#19

Сохранять integer `start_ms`/`end_ms` относительно начала исходной записи:
`round(seconds * 1000)`, интервал `[start_ms, end_ms)`,
`0 <= start_ms < end_ms <= duration_ms`. CLI только отмечает ошибки
границ; не маскирует их clamp-операцией. Не требовать отсутствия перекрытий
разных говорящих. При обработке кусков добавлять offset исходной записи,
а при overlap устранять дубли по тексту/времени без сдвига общей шкалы.
При VAD сохранить паузы на исходной шкале; проверить их кликом в плеере.

STT segment не устанавливает личность и не гарантирует смену говорящего.
Speaker/подтверждение имени — отдельный этап #12. Имена ответственных
не подставлять из голоса. ASR confidence и detected language — признаки
для проверки, не вероятность правильности поручения. Word alignment
не требуется для первого segment-based плеера; benchmark его не включает.

## Что должно появиться до закрытия #11

| Образец | Минимальное содержание | Требуемая ручная проверка | Сейчас |
| --- | --- | --- | --- |
| RU | Файл кейса + дословная человеческая разметка | Уточнения сроков, числа и разделение задач; документ-протокол не WER-эталон | Pending |
| KK | 60–120 секунд реального чтения синтетического текста носителем | Казахские буквы, имена, отрицания, числа, даты | Pending |
| Mixed | 60–120 секунд с переключением RU/KK между и внутри предложений | Сохранение обоих языков без перевода и пропуска сроков | Pending |

Синтетические тексты можно хранить как fixtures после согласования;
реальные персональные данные не нужны. Запись и эталон до прогона должен
проверить человек, знающий язык. TTS сам по себе не покрывает спонтанную
речь. Для каждого результата приложить настройки, RTF/RSS, WER/CER с
описанной нормализацией и отдельную таблицу ошибок имён/чисел/сроков.
Не сводить `і/и`, `қ/к`, `ң/н`, `ұ/ү/у` при оценке казахского.

Дополнительно проверить тишину, шум, перекрытие голосов, длинную запись,
потерю тихих слов при VAD и отсутствие повторов на стыках. Финальная
приёмка — реальный job с сохранёнными репликами, ручной проверкой трёх
сценариев и запретом egress после подготовки модели. До этого STT остаётся
непоставленным, как указано в [начальном состоянии](product-baseline.md).
