# Доступ плеера к записи

Нативный `<audio>` использует same-origin URL
`/api/media/meetings/{meeting_id}/recordings/{recording_id}`. Поддерживаются `GET`
и `HEAD`. Идентификаторы — UUID; JWT в URL и клиентские Bearer-заголовки для этого
маршрута не используются. Браузер отправляет существующую cookie Better Auth.

Серверный маршрут проверяет cookie через `auth.api.getToken`, передаёт полученный
короткоживущий JWT только внутреннему backend и потоково возвращает тело ответа.
Backend повторно проверяет активную сессию и владельца совещания в SQL; чужой
объект возвращает `404`. JWT, cookie и внутренний адрес backend не попадают в
ответ браузеру. Полный файл в памяти frontend не накапливается.

Серверная переменная `BACKEND_INTERNAL_URL` задаёт доверенный HTTP(S) origin без
пути, query, credentials и fragment: `http://backend:8000` внутри Docker Compose
или `http://127.0.0.1:8000` при локальном запуске. Значение не должно иметь префикс
`VITE_`. Путь назначения всегда фиксирован:
`/api/v1/meetings/{meeting_id}/recordings/{recording_id}/media`.

Маршрут передаёт только `Range`, `If-Range`, `If-None-Match`, а из ответа —
`Content-Type`, `Content-Length`, `Content-Range`, `Accept-Ranges`, `ETag`,
`Last-Modified` и HTTP-статус, включая `206`, `304` и `416`. Backend отдаёт
несжатые байты (`Accept-Encoding: identity`), чтобы длина и диапазоны совпадали.
`HEAD` всегда без тела. Отмена запроса браузером передаётся внутреннему fetch;
редиректы backend запрещены. `Set-Cookie`, CORS и hop-by-hop заголовки backend
не копируются.

Каждый ответ имеет `Cache-Control: private, no-store`,
`X-Content-Type-Options: nosniff` и `Cross-Origin-Resource-Policy: same-origin`.
Если присутствует `Origin`, он должен совпадать с origin `BETTER_AUTH_URL`;
запросы с `Sec-Fetch-Site: cross-site` или `same-site` отклоняются. Поэтому
плеер должен работать на том же origin, что и приложение, включая dev-стенды.

Ошибки proxy используют общий конверт `ErrorResponse`:
`422 validation_error`, `401 unauthorized`, `403 forbidden`,
`405 method_not_allowed`, `503 auth_unavailable` или `503 media_unavailable`.
Остальные HTTP-методы явно отклоняются с `Allow: GET, HEAD`, чтобы server route
не переходил в SPA fallback. Ошибки владельца и состояния
записи сохраняют статус и тело backend. Нельзя использовать этот URL в публичном
экспорте или как постоянную ссылку для внешнего участника: доступ требует сессии.
