# Frontend

Из корня: `bun run setup`, `bun run seed`, затем `bun run dev`.

TanStack Start SPA + React Query. Start обслуживает Better Auth; FastAPI — прикладные данные.

Production: `bun run build`, затем `bun run start` — `server.ts` отдаёт статику из `dist/client` и передаёт остальное в Start handler. `bun run preview` — только для локальной проверки сборки.

- `/` — защищённое рабочее пространство, `/login` — вход и регистрация.
- `src/app/routes` — тонкие маршруты; `src/pages` — страницы; `src/shared/api` — клиент API.
- `bun run ui:add <component>` — компоненты shadcn Base UI (вендор, не редактируются).
- `bun run i18n:add <key> "<ru>" "<kk>" "<en>"` — строка во все локали.
- `bun run generate` — маршруты и локализация (`ru`, `kk`, `en`).

Frontend-команды запускать из этой директории. Соглашения — в [`../docs/conventions.md`](../docs/conventions.md).
