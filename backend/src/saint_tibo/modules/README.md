# Предметные модули

Домены добавляются здесь по мере реализации: meetings, processing, action_items, exports.
Каждый модуль содержит модели, DTO, сервис и HTTP router. Порядок добавления —
в [соглашениях](../../../../docs/conventions.md).

Router подключается в `api/router.py`, модели — в `migrations/env.py`.
Права проверяются в HTTP-слое, владелец — в SQL-запросе. Сервис завершает
запись через `await session.commit()` общей сессии запроса.
