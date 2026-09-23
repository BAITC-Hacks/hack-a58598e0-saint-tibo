import { useLocale } from "#/shared/lib/locales";

const en = {
  title: "Reminders",
  help: "You are the curator of meetings you own. This inbox shows dated, unfinished actions from their latest reviewed results.",
  refreshHelp:
    "Updates every 30 seconds while the app is visible. Deadlines use each meeting’s time zone.",
  upcoming: "Due today or tomorrow",
  overdue: "Overdue",
  empty: "No reminders",
  emptyHelp:
    "There are no reviewed, unfinished actions due today, tomorrow, or earlier in your meetings.",
  emptyPage: "This page is empty. Return to the previous page.",
  loading: "Loading reminders…",
  error: "Could not refresh reminders. Retry to see the current deadlines.",
  signedOut: "Sign in to see reminders for meetings you own.",
  forbidden: "Your account does not have access to meeting reminders.",
  signIn: "Sign in",
  refresh: "Refresh",
  previous: "Previous",
  next: "Next",
  total: "Total",
  evaluated: "Updated",
  openMeeting: "Open meeting",
};
const ru: Record<keyof typeof en, string> = {
  title: "Напоминания",
  help: "Вы — куратор встреч, владельцем которых являетесь. Здесь показаны незавершённые поручения с датой из их последних проверенных результатов.",
  refreshHelp:
    "Обновление каждые 30 секунд, пока приложение видно на экране. Сроки определяются в часовом поясе каждой встречи.",
  upcoming: "Срок сегодня или завтра",
  overdue: "Просрочено",
  empty: "Напоминаний нет",
  emptyHelp:
    "В ваших встречах нет проверенных незавершённых поручений со сроком сегодня, завтра или ранее.",
  emptyPage: "На этой странице нет записей. Вернитесь на предыдущую страницу.",
  loading: "Загрузка напоминаний…",
  error:
    "Не удалось обновить напоминания. Повторите загрузку, чтобы увидеть актуальные сроки.",
  signedOut:
    "Войдите, чтобы увидеть напоминания по встречам, которыми вы владеете.",
  forbidden: "У вашей учётной записи нет доступа к напоминаниям встреч.",
  signIn: "Войти",
  refresh: "Обновить",
  previous: "Назад",
  next: "Далее",
  total: "Всего",
  evaluated: "Обновлено",
  openMeeting: "Открыть встречу",
};
const kk: Record<keyof typeof en, string> = {
  title: "Еске салулар",
  help: "Сіз өзіңіз иелік ететін кездесулердің кураторысыз. Мұнда олардың соңғы тексерілген нәтижелеріндегі мерзімі көрсетілген, аяқталмаған тапсырмалар бар.",
  refreshHelp:
    "Қолданба экранда көрініп тұрғанда әр 30 секунд сайын жаңартылады. Мерзімдер әр кездесудің уақыт белдеуімен анықталады.",
  upcoming: "Мерзімі бүгін немесе ертең",
  overdue: "Мерзімі өтті",
  empty: "Еске салулар жоқ",
  emptyHelp:
    "Кездесулеріңізде мерзімі бүгін, ертең немесе бұрын болған тексерілген, аяқталмаған тапсырмалар жоқ.",
  emptyPage: "Бұл бетте жазбалар жоқ. Алдыңғы бетке оралыңыз.",
  loading: "Еске салулар жүктелуде…",
  error:
    "Еске салуларды жаңарту мүмкін болмады. Өзекті мерзімдерді көру үшін қайта жүктеңіз.",
  signedOut:
    "Өзіңіз иелік ететін кездесулердің еске салуларын көру үшін кіріңіз.",
  forbidden: "Тіркелгіңізде кездесу еске салуларына рұқсат жоқ.",
  signIn: "Кіру",
  refresh: "Жаңарту",
  previous: "Артқа",
  next: "Келесі",
  total: "Барлығы",
  evaluated: "Жаңартылды",
  openMeeting: "Кездесуді ашу",
};

export const useRemindersCopy = () => ({ en, ru, kk })[useLocale()];
