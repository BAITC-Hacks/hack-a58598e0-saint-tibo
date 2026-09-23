---
version: alpha
name: Хаттама
description: Рабочий интерфейс протоколов совещаний и поручений
colors:
  navy: "#17335D"
  navy-deep: "#162840"
  gold: "#A88C6D"
  gold-deep: "#7A6248"
  bird: "#937E65"
  paper: "#F4F1EC"
  surface: "#FFFFFF"
  ink: "#323232"
  muted: "#4E5966"
  line: "#E3DDD4"
  link-focus: "#0060BA"
  success: "#1C6B45"
  success-bg: "#E6F2EB"
  danger: "#8E2F2F"
  danger-bg: "#F8E9E6"
  work-bg: "#E7EEF6"
  warning: "#8A5A12"
  warning-bg: "#F8F1E3"
  dark-paper: "#111E31"
  dark-surface: "#1B3351"
  dark-gold: "#D6B994"
typography:
  page-title:
    fontFamily: PT Sans
    fontSize: 26px
    fontWeight: 700
    lineHeight: 1.15
  product:
    fontFamily: PT Sans
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: 0.01em
  body:
    fontFamily: PT Sans
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.4
  metadata:
    fontFamily: PT Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 14px
  xl: 18px
  page: 22px
  header-height: 64px
  sidebar-width: 228px
rounded:
  control: 2px
  surface: 2px
  pill: 9999px
components:
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.navy}"
    rounded: "{rounded.control}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
  navigation:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.paper}"
---

## Overview

Хаттама — рабочее пространство для встреч, протоколов и поручений. Экран должен быть плотным и спокойным: быстрое сканирование списка, ясное состояние обработки, доступные действия. Логотип организации используется исходным SVG на белой шапке; название продукта стоит отдельно за золотой линией 1 × 36 px с зазором 14 px. Полноцветный знак не помещается на тёмный фон.

## Colors

Светлая тема в `frontend/src/app/styles/globals.css` использует `--background: #F4F1EC`, `--card: #FFFFFF`, `--foreground: #323232`, `--primary: #17335D`, `--border: #E3DDD4`. Золото `#A88C6D` отмечает линию под шапкой и активную навигацию; для небольшого текста на белом фоне используется более тёмный `#7A6248`. Ссылки и фокус — `#0060BA`. Состояния: успех `#1C6B45`, просрочка `#8E2F2F`, ожидание `#8A5A12`, работа `#E7EEF6`; всегда рядом с текстовой меткой.

Тёмная тема сохраняет цветовые роли, но использует бумагу `#111E31`, карточки `#1B3351`, светлый текст `#F4F1EC` и золото `#D6B994`. Белая шапка остаётся белой, чтобы исходный логотип был читаемым. Режим повышенного контраста имеет приоритет над темой.

## Typography

Один шрифт PT Sans, локальные файлы 400/700 для кириллицы, латиницы и расширенных наборов. Базовый текст 15/21 px, заголовок страницы 26 px с межстрочным 1.15, имя продукта 20 px с 1.1, подписи 12 px. Данные времени и чисел используют табличные цифры. Казахские буквы проверяются в реальном интерфейсе.

## Layout

Шапка минимум 64 px, золотая линия 3 px, сайдбар 228 px. Контент: 22 px по краям на десктопе, 18 px на планшете, 12–14 px на мобильном экране. Карточки и строки используют ритм 8/12/14/18 px. До 1100 px навигация открывается доступной клавиатуре боковой панелью; контент перестраивается в одну колонку, без горизонтальной прокрутки при 320 px.

## Elevation & Depth

Иерархия строится на бумажном фоне и белых поверхностях с линией `#E3DDD4`. Обычные карточки без тени; приподнятая поверхность может иметь тень `0 8px 24px rgba(23,51,93,.08)` (например, форма входа). Наведение и выбор показываются фоном и рамкой, не одной тенью.

## Shapes

Прямые спокойные края: 2 px у контролов и карточек. Круглая форма остаётся для аватара и маркеров статуса. Толщина золотой линии в шапке 3 px; разделитель логотипа 1 px.

## Components

Компонентный API и размещение описаны в `docs/ui-kit.md` и `docs/ui-architecture.md`. Главная кнопка использует navy/white, вторичная — белую поверхность и navy, состояние hover — изменение фона, `focus-visible` — контрастную обводку 2 px. Disabled и loading остаются видимыми и недоступными для повторного нажатия. Input, Select, Dialog и Toast используют существующие Base UI/shadcn компоненты и семантические CSS-токены. Ошибка поля имеет текст и `aria-invalid`. Никакой статус не определяется только цветом.

## Do's and Don'ts

- Использовать исходные логотип и PT Sans, не перерисовывать знак.
- Давать одну основную кнопку на группу действий и единые состояния через shared UI.
- Проверять RU/KK/EN, длинные подписи, 320 px, клавиатуру и `prefers-reduced-motion`.
- Не ставить полноцветный логотип на navy и не делать золотой мелкий текст на белом фоне.
- Не вводить локальные палитры, самодельные кнопки и отдельные папки Atomic Design.
