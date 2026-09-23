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

Перед интеграцией — `bun run verify`. Авторизация/миграции дополнительно
проверяются через `bun run test:integration`. После изменения API —
`bun run api:generate`; контракт и SDK включаются в тот же срез.

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
bun run verify
git push origin dev
```

Участники используют соответственно `ivan` и `artem`.
Конфликты разрешаются до push с проверкой общего результата.
Историю общих веток не переписывать, force-push и squash не применять.
Статус реализации и доказательство проверки записывать в issue.

CI на push и pull request: сборка, существующие проверки, миграции,
авторизация, сверка OpenAPI-клиента и сборка контейнеров.
Production и DNS настраиваются отдельно; ветка не означает deployment.
