# Доступ

Better Auth владеет аккаунтами и cookie-сессиями в `auth` (Drizzle).
FastAPI владеет прикладными правами и данными в `app` (SQLAlchemy/Alembic).

JWT действует 5 минут. FastAPI проверяет подпись через JWKS и актуальные роль,
блокировку и сессию через `auth/identity.py`, поэтому отзыв сессии и смена роли
действуют со следующего запроса к FastAPI. Сам по себе выданный JWT не отзывается —
список отозванных токенов не ведётся; окно ограничено временем жизни токена.
Браузерный клиент переиспользует токен до истечения срока и сбрасывает его при
смене сессии. Роли из JWT или входного запроса не дают прав.
Сохраняйте `BETTER_AUTH_SECRET`: им зашифрованы приватные JWT-ключи в БД.

| Политика | Источник |
| --- | --- |
| Прикладные роли и permissions | `backend/src/saint_tibo/auth/policy.py` |
| Операции Better Auth Admin plugin | `frontend/src/shared/auth/admin-access.ts` |
| Эффективные права интерфейса | `GET /api/v1/me` → `#/shared/auth` |
| Типы Role / Permission / CurrentUser | OpenAPI → сгенерированный клиент |

Обе роли имеют `profile:read`, `meeting:read`, `meeting:write`.
Совещания, участники и записи дополнительно ограничены владельцем в SQL;
участник протокола не получает доступ автоматически, admin не обходит owner ACL.
Cookie media proxy получает серверный JWT и повторно проходит эти же проверки API.
Только `admin`: `access:read`, `users:read`,
`users:manage`, `sessions:revoke`. Новые permissions выдаются явно;
неизвестные роли запрещены. Admin plugin отдельно проверяет операции с аккаунтами.
Публичная регистрация создаёт обычного пользователя. Первый администратор
назначается вне приложения: `bun run seed` создаёт `admin@saint-tibo.local`,
`bun run admin:grant <email>` повышает существующий аккаунт.

## Запись в `app` по событию Better Auth

Better Auth коммитит операцию в `auth` до того, как отработает `after`-хук, и пишет
в другую схему из другого процесса. Атомарности между «действие» и «запись в `app`»
нет — это ограничение разделения владельцев, а не недоработка.

Если такая запись нужна: `after`-хук получает JWT через `auth.api.getToken` и вызывает
FastAPI, чтобы бэкенд проверил актора сам. `after`-хук срабатывает и на неуспешных
операциях — проверяйте `isAPIError` перед записью. Ошибку записи логируйте, но не
пробрасывайте: операция уже выполнена.

## Изменения API

Добавляйте permission и grants в `policy.py`, защищайте endpoint через
`Depends(require_permissions(...))`. Все переданные permissions обязательны.
Для личных данных проверяйте владельца в запросе к БД. Auth lookup уже открывает
транзакцию; завершайте изменения `await session.commit()`.

После изменений запускайте `bun run api:generate` и проверяйте разрешённый и
запрещённый доступ. Для новой роли также обновите auth CHECK constraint миграцией,
`adminRoles` и `admin-access.ts`.

## Frontend

Используйте `useAccess`, `Can`, `requireAccess` из `#/shared/auth`.
`requireAccess` перенаправляет анонимного пользователя на `/login`, при нехватке
прав возвращает 403. Backend проверяет каждую операцию независимо от UI.
Не проверяйте строки `user.role` в компонентах.

После административного изменения вызывайте `invalidateAccess(queryClient)`.
`AuthCacheBoundary` отменяет запросы и очищает кеш при logout/смене сессии.
`backendClient` получает JWT через cookie-сессию; серверный код использует
`createBackendClient` с токеном конкретного запроса.

В сгенерированных Query options ключ — tuple из одного объекта. Для приватных
запросов добавляйте идентификатор сессии в `tags`, сохраняя форму ключа:

```ts
const options = getCurrentUserOptions({ client: backendClient });
options.queryKey[0].tags = [sessionId ?? "anonymous"];
const query = useQuery({ ...options, enabled: Boolean(sessionId) });
```

Используйте такой же ключ при invalidation; токен доступа в ключ не включайте.

`bun run test:integration` проверяет миграции и реальную авторизацию в одноразовой
БД, затем удаляет её.
