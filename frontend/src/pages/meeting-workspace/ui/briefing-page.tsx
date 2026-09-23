import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Search, Users, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { MeetingRead } from "#/shared/api";
import { useLocale } from "#/shared/lib/locales";
import { Button } from "#/shared/ui/shadcn/button";
import { Input } from "#/shared/ui/shadcn/input";

import { meetingsQuery, participantsQuery } from "../api/meetings";
import { reviewQuery, type ReviewDocument } from "../api/review";

const copy = {
  ru: {
    title: "Брифинг перед встречей",
    help: "Выберите участников, добавленных во встречи. Имена, извлечённые ИИ из поручений, не считаются подтверждёнными до добавления участника в карточку встречи.",
    search: "Имя или роль…",
    latest: "Участники последней встречи",
    overdue: "С просроченными поручениями",
    build: "Собрать брифинг",
    clear: "Сбросить",
    selected: "Выбрано",
    people: "Участники",
    results: "Брифинг",
    meetings: "Встречи",
    tasks: "Поручения",
    deadline: "Срок",
    decisions: "Решения",
    questions: "Открытые вопросы",
    topics: "Темы",
    emptyPeople:
      "Пока нет добавленных участников в доступных встречах. Добавьте их в карточке встречи.",
    noMatch: "По запросу никого не найдено.",
    emptySelection: "Выберите хотя бы одного участника.",
    emptyBrief:
      "Для этого человека пока нет сохранённых выводов или поручений. Откройте встречу и сформируйте протокол.",
    loading: "Загрузка встреч и протоколов…",
    error: "Не удалось загрузить данные для брифинга.",
    retry: "Повторить",
    recent: "Показаны данные из последних 20 встреч.",
    overdueTag: "Просрочено",
    source: "Источник",
    unknown: "Роль не указана",
  },
  kk: {
    title: "Кездесу алдындағы брифинг",
    help: "Кездесулерге қосылған қатысушыларды таңдаңыз. ЖИ тапсырмалардан тапқан есімдер қатысушы кездесу картасына қосылғанша расталған болып саналмайды.",
    search: "Аты немесе рөлі…",
    latest: "Соңғы кездесудің қатысушылары",
    overdue: "Мерзімі өткен тапсырмалар",
    build: "Брифинг құрастыру",
    clear: "Тазалау",
    selected: "Таңдалды",
    people: "Қатысушылар",
    results: "Брифинг",
    meetings: "Кездесулер",
    tasks: "Тапсырмалар",
    deadline: "Мерзім",
    decisions: "Шешімдер",
    questions: "Ашық сұрақтар",
    topics: "Тақырыптар",
    emptyPeople:
      "Қолжетімді кездесулерде қосылған қатысушылар әзірге жоқ. Оларды кездесу картасына қосыңыз.",
    noMatch: "Сұрау бойынша ешкім табылмады.",
    emptySelection: "Кемінде бір қатысушыны таңдаңыз.",
    emptyBrief:
      "Бұл адамға қатысты сақталған қорытынды немесе тапсырма әзірге жоқ. Кездесуді ашып, хаттама құрастырыңыз.",
    loading: "Кездесулер мен хаттамалар жүктелуде…",
    error: "Брифинг деректерін жүктеу мүмкін болмады.",
    retry: "Қайталау",
    recent: "Соңғы 20 кездесудің деректері көрсетілген.",
    overdueTag: "Мерзімі өтті",
    source: "Дереккөз",
    unknown: "Рөлі көрсетілмеген",
  },
  en: {
    title: "Pre-meeting briefing",
    help: "Select people added to meetings. Names extracted from assignments by AI are unverified until the participant is added to the meeting.",
    search: "Name or role…",
    latest: "Latest meeting participants",
    overdue: "Overdue assignments",
    build: "Build briefing",
    clear: "Clear",
    selected: "Selected",
    people: "Participants",
    results: "Briefing",
    meetings: "Meetings",
    tasks: "Assignments",
    deadline: "Due",
    decisions: "Decisions",
    questions: "Open questions",
    topics: "Topics",
    emptyPeople:
      "No participants have been added to your accessible meetings yet. Add them in a meeting.",
    noMatch: "No people match your search.",
    emptySelection: "Select at least one participant.",
    emptyBrief:
      "No saved conclusions or assignments for this person yet. Open a meeting and generate minutes.",
    loading: "Loading meetings and minutes…",
    error: "Could not load briefing data.",
    retry: "Retry",
    recent: "Showing data from the latest 20 meetings.",
    overdueTag: "Overdue",
    source: "Source",
    unknown: "Role unavailable",
  },
} as const;

type Person = {
  key: string;
  name: string;
  role: string | null;
  meetingIds: Set<string>;
  participantIds: Set<string>;
};
type MeetingData = { meeting: MeetingRead; review: ReviewDocument | null };
const personKey = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase();

function MeetingLink({ meeting }: { meeting: MeetingRead }) {
  return (
    <Link
      className="underline underline-offset-2 hover:text-primary"
      to="/meetings/$meetingId"
      params={{ meetingId: meeting.id }}
    >
      {meeting.title}
    </Link>
  );
}

export function BriefingPage() {
  const locale = useLocale();
  const t = copy[locale];
  const meetings = useQuery(meetingsQuery(0));
  const recent = useMemo(
    () =>
      (meetings.data?.items ?? [])
        .toSorted((a, b) => b.started_at.localeCompare(a.started_at))
        .slice(0, 20),
    [meetings.data]
  );
  const participants = useQueries({
    queries: recent.map((meeting) => participantsQuery(meeting.id)),
  });
  const reviews = useQueries({
    queries: recent.map((meeting) => reviewQuery(meeting.id)),
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [built, setBuilt] = useState<Set<string> | null>(null);

  const people = useMemo(() => {
    const byName = new Map<string, Person>();
    const ensure = (name: string) => {
      const key = personKey(name);
      if (!key) return null;
      let person = byName.get(key);
      if (!person) {
        person = {
          key,
          name: name.trim(),
          role: null,
          meetingIds: new Set(),
          participantIds: new Set(),
        };
        byName.set(key, person);
      }
      return person;
    };
    recent.forEach((meeting, index) => {
      participants[index]?.data?.items.forEach((item) => {
        const person = ensure(item.display_name);
        if (!person) return;
        person.role ||= item.role;
        person.meetingIds.add(meeting.id);
        person.participantIds.add(item.id);
      });
    });
    return [...byName.values()].toSorted((a, b) =>
      a.name.localeCompare(b.name, locale)
    );
  }, [recent, participants, locale]);

  const meetingData: MeetingData[] = recent.map((meeting, index) => ({
    meeting,
    review: reviews[index]?.data ?? null,
  }));
  const latestPeople = people.filter((person) =>
    person.meetingIds.has(recent[0]?.id)
  );
  const today = new Date().toISOString().slice(0, 10);
  const overduePeople = people.filter((person) =>
    meetingData.some(({ review }) =>
      review?.action_items.some(
        (item) =>
          item.status !== "done" &&
          item.status !== "cancelled" &&
          !!item.due_date &&
          item.due_date < today &&
          ((item.assignee_participant_id &&
            person.participantIds.has(item.assignee_participant_id)) ||
            (!!item.assignee_text &&
              personKey(item.assignee_text) === person.key))
      )
    )
  );
  const filtered = people.filter((person) =>
    `${person.name} ${person.role ?? ""}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase().trim())
  );
  const loading =
    meetings.isPending ||
    participants.some((query) => query.isPending) ||
    reviews.some((query) => query.isPending);
  const failed =
    meetings.isError ||
    participants.some((query) => query.isError) ||
    reviews.some((query) => query.isError);

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.help}</p>
      </header>
      {loading ? (
        <output className="block rounded-xl border p-8">{t.loading}</output>
      ) : failed ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 p-6"
        >
          <p>{t.error}</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => {
              void meetings.refetch();
              participants.forEach((query) => void query.refetch());
              reviews.forEach((query) => void query.refetch());
            }}
          >
            {t.retry}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">
              {t.people}{" "}
              <span className="text-muted-foreground">{people.length}</span>
            </h2>
            <div className="flex gap-2">
              {selected.size > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelected(new Set());
                    setBuilt(null);
                  }}
                >
                  {t.clear}
                </Button>
              )}
              <Button
                disabled={!selected.size}
                onClick={() => setBuilt(new Set(selected))}
              >
                {t.build}
                {selected.size ? ` (${selected.size})` : ""}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative min-w-64 flex-1 sm:max-w-sm">
              <span className="sr-only">{t.search}</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
              />
              <Input
                className="pl-9"
                placeholder={t.search}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && filtered[0]) {
                    toggle(filtered[0].key);
                    setSearch("");
                  }
                }}
              />
            </label>
            {latestPeople.length > 0 && (
              <Button
                variant="outline"
                onClick={() =>
                  setSelected(new Set(latestPeople.map((person) => person.key)))
                }
              >
                <Users aria-hidden="true" />
                {t.latest} ({latestPeople.length})
              </Button>
            )}
            {overduePeople.length > 0 && (
              <Button
                variant="outline"
                onClick={() =>
                  setSelected(
                    new Set(overduePeople.map((person) => person.key))
                  )
                }
              >
                {t.overdue} ({overduePeople.length})
              </Button>
            )}
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-2" aria-label={t.selected}>
              {people
                .filter((person) => selected.has(person.key))
                .map((person) => (
                  <button
                    type="button"
                    key={person.key}
                    onClick={() => toggle(person.key)}
                    className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-sm hover:bg-muted"
                  >
                    {person.name}
                    <X className="size-3" aria-hidden="true" />
                  </button>
                ))}
            </div>
          )}
          <div className="max-h-[50vh] overflow-y-auto rounded-xl border bg-card">
            {filtered.map((person) => (
              <button
                type="button"
                key={person.key}
                aria-pressed={selected.has(person.key)}
                onClick={() => toggle(person.key)}
                className="flex w-full items-center gap-3 border-b p-3 text-left last:border-0 hover:bg-muted/50 aria-pressed:bg-primary/10"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold">
                  {person.name.slice(0, 2).toLocaleUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {person.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {person.role ?? t.unknown} · {person.meetingIds.size}{" "}
                    {t.meetings.toLocaleLowerCase()}
                  </span>
                </span>
                <span aria-hidden="true" className="text-primary">
                  {selected.has(person.key) ? "✓" : ""}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">
                {people.length ? t.noMatch : t.emptyPeople}
              </p>
            )}
          </div>
          {meetings.data && meetings.data.total > 20 && (
            <p className="text-xs text-muted-foreground">{t.recent}</p>
          )}
          {built && (
            <div className="space-y-4 pt-3">
              <h2 className="text-xl font-semibold">{t.results}</h2>
              {people
                .filter((person) => built.has(person.key))
                .map((person) => {
                  const related = meetingData.filter(({ meeting }) =>
                    person.meetingIds.has(meeting.id)
                  );
                  const assignments = meetingData.flatMap(
                    ({ meeting, review }) =>
                      (review?.action_items ?? [])
                        .filter(
                          (item) =>
                            (item.status === "open" ||
                              item.status === "in_progress") &&
                            ((!!item.assignee_participant_id &&
                              person.participantIds.has(
                                item.assignee_participant_id
                              )) ||
                              (!!item.assignee_text &&
                                personKey(item.assignee_text) === person.key))
                        )
                        .map((item) => ({ meeting, item }))
                  );
                  const sections = [
                    {
                      title: t.topics,
                      rows: related.flatMap(({ meeting, review }) =>
                        (review?.summary.topics ?? []).map((entry) => ({
                          meeting,
                          text: entry.text,
                        }))
                      ),
                    },
                    {
                      title: t.decisions,
                      rows: related.flatMap(({ meeting, review }) =>
                        (review?.summary.decisions ?? []).map((entry) => ({
                          meeting,
                          text: entry.text,
                        }))
                      ),
                    },
                    {
                      title: t.questions,
                      rows: related.flatMap(({ meeting, review }) =>
                        (review?.summary.open_questions ?? []).map((entry) => ({
                          meeting,
                          text: entry.text,
                        }))
                      ),
                    },
                  ];
                  const hasContent =
                    assignments.length > 0 ||
                    sections.some((section) => section.rows.length > 0);
                  return (
                    <article
                      key={person.key}
                      className="space-y-4 rounded-xl border bg-card p-5"
                    >
                      <h3 className="text-lg font-semibold">
                        {person.name}{" "}
                        {person.role && (
                          <span className="text-sm font-normal text-muted-foreground">
                            · {person.role}
                          </span>
                        )}
                      </h3>
                      {assignments.length > 0 && (
                        <div>
                          <h4 className="font-medium">
                            {t.tasks} ({assignments.length})
                          </h4>
                          <ul className="mt-2 space-y-2">
                            {assignments.map(({ meeting, item }) => (
                              <li
                                key={`${meeting.id}-${item.id}`}
                                className="rounded-lg border p-3 text-sm"
                              >
                                <p>{item.text}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.due_date || item.due_text
                                    ? `${t.deadline}: ${item.due_date ?? item.due_text} · `
                                    : ""}
                                  {item.due_date &&
                                  item.due_date < today &&
                                  item.status !== "done" &&
                                  item.status !== "cancelled"
                                    ? `${t.overdueTag} · `
                                    : ""}
                                  <MeetingLink meeting={meeting} />
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {sections.map(
                        (section) =>
                          section.rows.length > 0 && (
                            <div key={section.title}>
                              <h4 className="font-medium">{section.title}</h4>
                              <ul className="mt-2 space-y-2">
                                {section.rows.map(
                                  ({ meeting, text }, index) => (
                                    <li
                                      key={`${meeting.id}-${index}`}
                                      className="text-sm"
                                    >
                                      {text}{" "}
                                      <span className="text-xs text-muted-foreground">
                                        · <MeetingLink meeting={meeting} />
                                      </span>
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )
                      )}
                      {!hasContent && (
                        <p className="text-sm text-muted-foreground">
                          {t.emptyBrief}
                        </p>
                      )}
                    </article>
                  );
                })}
              {built.size === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t.emptySelection}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
