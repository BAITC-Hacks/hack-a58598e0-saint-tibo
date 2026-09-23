# Командная разработка

| Ветка | Участник / назначение |
| --- | --- |
| `danil` | [rldyourmnd](https://github.com/rldyourmnd), интеграция и релизы |
| `ivan` | [R3flector](https://github.com/R3flector) |
| `artem` | [letya999](https://github.com/letya999) |
| `dev` | Общая интеграция |
| `main` | Согласованная стабильная версия |

Поток: `feat/<issue>-<slug>` → личная ветка → `dev` → `main`.
Каждый участник сам вливает свою ветку в `dev`. Релиз `dev` → `main`
ведёт Данил. Ветки коллег не изменяем.

## Начало задачи

Создать/взять issue, указать результат и закрепить файлы комментарием.
От актуального `origin/dev` создать отдельный worktree:

```sh
git fetch origin
git worktree add ../saint-tibo-task -b feat/42-meeting-upload origin/dev
```

Номер и название заменить на реальные. Для параллельных копий до `setup`
задать разные порты, имя базы и `COMPOSE_PROJECT_NAME` в `.env`.
Коммиты: `feat:`, `fix:`, `docs:`, `chore:` и конкретное изменение.

Текущий режим по указанию владельца от 2026-09-23: не писать и не запускать
тестовые наборы; собирать приложение для deployment и коротко проверять
изменённый сценарий на живом dev-сервере. Команды `verify` и
`test:integration` остаются доступными для последующего возврата к полным
проверкам. После изменения API — `bun run api:generate`; контракт и SDK
включаются в тот же срез.

## Интеграция

```sh
git fetch origin
git switch danil                     # каждый использует свою ветку
git merge --ff-only origin/danil
git merge --no-ff feat/42-meeting-upload
git push origin danil
git switch dev
git merge --ff-only origin/dev
git merge --no-ff danil
git push origin dev
```

Участники используют соответственно `ivan` и `artem`.
Конфликты разрешаются до push с проверкой общего результата.
Историю общих веток не переписывать, force-push и squash не применять.
Статус реализации и доказательство проверки записывать в issue.

CI/CD не используется. Каждый участник вручную запускает и проверяет свою
работу на личном dev-сервере: `saint-dev-danil`, `saint-dev-ivan`,
`saint-dev-artem`. После интеграции так же проверяется актуальный `dev`.
Порядок — в [инструкции запуска](dev-server.md). Push ничего не развёртывает.
Быстрый вход и браузерный сценарий — в [browser-testing.md](browser-testing.md).
Production обновляет Данил вручную из согласованного `main`; адреса
окружений и порядок запуска указаны в той же инструкции.
