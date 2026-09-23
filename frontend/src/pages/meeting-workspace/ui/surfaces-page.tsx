import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { isMockApi } from "#/shared/api";
import { authClient, useAccess } from "#/shared/auth";
import { useLocale } from "#/shared/lib/locales";
import { Button } from "#/shared/ui/shadcn/button";
import { Input } from "#/shared/ui/shadcn/input";

import { meetingsQuery, participantsQuery } from "../api/meetings";
import { reviewQuery } from "../api/review";
import { useCopy } from "../lib/copy";

export type SurfaceKind =
  | "today"
  | "tasks"
  | "calendar"
  | "agenda"
  | "analytics"
  | "people"
  | "person"
  | "briefing"
  | "ask"
  | "profile"
  | "adminUsers"
  | "adminDirectory"
  | "adminAccess";

export function SurfacesPage({
  kind,
  personId,
}: {
  kind: SurfaceKind;
  personId?: string;
}) {
  const t = useCopy();
  const locale = useLocale();
  const session = authClient.useSession();
  const access = useAccess();
  const meetings = useQuery(meetingsQuery(0));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");
  const [selectedDay, setSelectedDay] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [month, setMonth] = useState(() => new Date());
  const meetingIds = useMemo(
    () => meetings.data?.items.slice(0, 20).map((item) => item.id) ?? [],
    [meetings.data]
  );
  const participantQueries = useQueries({
    queries: meetingIds.map((id) => participantsQuery(id)),
  });
  const reviewQueries = useQueries({
    queries: meetingIds.map((id) => reviewQuery(id)),
  });
  const reviewError = reviewQueries.some((query) => query.isError);
  const loading =
    meetings.isPending ||
    participantQueries.some((query) => query.isPending) ||
    reviewQueries.some((query) => query.isPending);
  const people = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        role: string | null;
        meetingIds: string[];
        participantIds: string[];
      }
    >();
    participantQueries.forEach((query, index) => {
      query.data?.items.forEach((participant) => {
        const current = map.get(participant.display_name.toLocaleLowerCase());
        if (current) {
          current.meetingIds.push(meetingIds[index]);
          current.participantIds.push(participant.id);
        } else
          map.set(participant.display_name.toLocaleLowerCase(), {
            id: participant.id,
            name: participant.display_name,
            role: participant.role,
            meetingIds: [meetingIds[index]],
            participantIds: [participant.id],
          });
      });
    });
    return [...map.values()].toSorted((a, b) => a.name.localeCompare(b.name));
  }, [participantQueries, meetingIds]);
  const tasks = useMemo(
    () =>
      reviewQueries.flatMap((query, index) =>
        (query.data?.action_items ?? []).map((item) => ({
          ...item,
          meetingId: meetingIds[index],
          meetingTitle: meetings.data?.items[index]?.title ?? "",
          source: query.data?.source ?? "real",
        }))
      ),
    [reviewQueries, meetingIds, meetings.data]
  );
  const filteredTasks = tasks.filter(
    (item) =>
      (status === "all" || item.status === status) &&
      (owner === "all" ||
        people
          .find((person) => person.id === owner)
          ?.participantIds.includes(item.assignee_participant_id ?? "")) &&
      `${item.text} ${item.meetingTitle} ${item.assignee_text ?? ""}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase())
  );
  const visibleTasks =
    kind === "person"
      ? filteredTasks.filter((item) =>
          people
            .find((person) => person.id === personId)
            ?.participantIds.includes(item.assignee_participant_id ?? "")
        )
      : kind === "agenda"
        ? filteredTasks
            .filter(
              (item) =>
                (item.status === "open" || item.status === "in_progress") &&
                item.due_date &&
                item.due_date >= new Date().toISOString().slice(0, 10)
            )
            .toSorted((a, b) =>
              (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
            )
        : kind === "today"
          ? filteredTasks
              .filter(
                (item) =>
                  item.status === "open" || item.status === "in_progress"
              )
              .toSorted((a, b) =>
                (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
              )
              .slice(0, 6)
          : filteredTasks;
  const title = t[kind === "person" ? "people" : kind];
  const unavailable = [
    "ask",
    "adminUsers",
    "adminDirectory",
    "adminAccess",
  ].includes(kind);

  if (kind === "profile") {
    return (
      <section className="mx-auto max-w-4xl space-y-5">
        <h1 className="text-2xl font-semibold">{t.profile}</h1>
        <div className="rounded-xl border bg-card p-5">
          <p className="font-medium">{session.data?.user.name ?? t.unknown}</p>
          <p className="text-sm text-muted-foreground">
            {session.data?.user.email ?? ""}
          </p>
        </div>
        <div className="rounded-xl border p-5 text-sm">
          <p>{access.user?.role ?? t.unknown}</p>
          <p>{access.user?.permissions.join(" · ") ?? t.detailsUnavailable}</p>
        </div>
      </section>
    );
  }

  if (unavailable && isMockApi())
    return (
      <DemoExtras
        kind={kind}
        title={title}
        search={search}
        setSearch={setSearch}
        meetings={meetings.data?.items ?? []}
        reviews={reviewQueries.map((query) => query.data)}
        people={people}
        loading={loading}
        error={
          meetings.isError ||
          reviewError ||
          participantQueries.some((query) => query.isError)
        }
        retry={() => {
          void meetings.refetch();
          reviewQueries.forEach((query) => void query.refetch());
          participantQueries.forEach((query) => void query.refetch());
        }}
      />
    );

  if (unavailable)
    return (
      <section className="mx-auto max-w-5xl space-y-5">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
          {t.unavailable}
        </div>
      </section>
    );

  if (
    meetings.isError ||
    reviewError ||
    participantQueries.some((query) => query.isError)
  )
    return (
      <div role="alert" className="rounded-xl border border-destructive/40 p-8">
        <p>{t.error}</p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => {
            void meetings.refetch();
            reviewQueries.forEach((query) => void query.refetch());
            participantQueries.forEach((query) => void query.refetch());
          }}
        >
          {t.retry}
        </Button>
      </div>
    );

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      {kind === "person" && (
        <Link
          className="text-sm text-muted-foreground hover:underline"
          to="/people"
        >
          ← {t.people}
        </Link>
      )}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {kind === "person"
              ? (people.find((person) => person.id === personId)?.name ??
                t.unknown)
              : title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {kind === "today"
              ? t.meetingsHelp
              : kind === "tasks"
                ? t.actions
                : kind === "people"
                  ? t.participants
                  : kind === "briefing"
                    ? t.summary
                    : t.meetingsHelp}
          </p>
        </div>
        {kind === "today" && (
          <Button nativeButton={false} render={<Link to="/meetings/new" />}>
            {t.newMeeting}
          </Button>
        )}
      </header>
      {isMockApi() && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          {t.sample}
        </p>
      )}
      {loading ? (
        <output className="block rounded-xl border p-8">{t.loading}</output>
      ) : (
        <>
          {kind === "today" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label={t.meetings} value={meetings.data?.total ?? 0} />
              <Stat label={t.actions} value={tasks.length} />
              <Stat
                label={t.open}
                value={tasks.filter((item) => item.status === "open").length}
              />
            </div>
          )}
          {(kind === "today" ||
            kind === "tasks" ||
            kind === "agenda" ||
            kind === "analytics" ||
            kind === "person") && (
            <>
              {kind === "analytics" && (
                <div className="grid gap-4 sm:grid-cols-4">
                  <Stat label={t.actions} value={tasks.length} />
                  <Stat
                    label={t.open}
                    value={
                      tasks.filter((item) => item.status === "open").length
                    }
                  />
                  <Stat
                    label={t.done}
                    value={
                      tasks.filter((item) => item.status === "done").length
                    }
                  />
                  <Stat
                    label={t.unknown}
                    value={
                      tasks.filter((item) => !item.assignee_participant_id)
                        .length
                    }
                  />
                </div>
              )}
              {kind === "tasks" && (
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="w-full sm:max-w-sm"
                    type="search"
                    aria-label={t.search}
                    placeholder={t.search}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <select
                    aria-label={t.status}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="all">{t.all}</option>
                    <option value="open">{t.open}</option>
                    <option value="in_progress">{t.running}</option>
                    <option value="done">{t.done}</option>
                    <option value="cancelled">{t.dropped}</option>
                  </select>
                  <select
                    aria-label={t.owner}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={owner}
                    onChange={(event) => setOwner(event.target.value)}
                  >
                    <option value="all">{t.all}</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="overflow-hidden rounded-xl border bg-card">
                {visibleTasks.map((item) => (
                  <Link
                    key={`${item.meetingId}:${item.id}`}
                    className="block border-b p-4 last:border-0 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
                    to="/meetings/$meetingId"
                    params={{ meetingId: item.meetingId }}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong className="font-medium">{item.text}</strong>
                      <span className="text-sm text-muted-foreground">
                        {item.due_date
                          ? new Intl.DateTimeFormat(locale, {
                              dateStyle: locale === "kk" ? "short" : "medium",
                            }).format(new Date(`${item.due_date}T00:00:00`))
                          : (item.due_text ?? t.unknown)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {people.find((person) =>
                        person.participantIds.includes(
                          item.assignee_participant_id ?? ""
                        )
                      )?.name ??
                        item.assignee_text ??
                        t.unknown}{" "}
                      · {item.meetingTitle}
                    </div>
                  </Link>
                ))}
                {!visibleTasks.length && (
                  <p className="p-6 text-sm text-muted-foreground">
                    {t.noItems}
                  </p>
                )}
              </div>
              {kind === "today" && (
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={<Link to="/meetings" />}
                >
                  {t.back}
                </Button>
              )}
            </>
          )}

          {kind === "calendar" && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="flex items-center justify-between border-b p-4">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() - 1, 1)
                      )
                    }
                  >
                    ←
                  </Button>
                  <h2 className="font-medium">
                    {new Intl.DateTimeFormat(locale, {
                      month: locale === "kk" ? "2-digit" : "long",
                      year: "numeric",
                    }).format(month)}
                  </h2>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() + 1, 1)
                      )
                    }
                  >
                    →
                  </Button>
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: 35 }, (_, index) => {
                    const first = new Date(
                      month.getFullYear(),
                      month.getMonth(),
                      1
                    );
                    const shift = (first.getDay() + 6) % 7;
                    const day = new Date(
                      month.getFullYear(),
                      month.getMonth(),
                      index - shift + 1
                    );
                    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                    const count =
                      (meetings.data?.items ?? []).filter(
                        (meeting) => meeting.started_at.slice(0, 10) === iso
                      ).length +
                      tasks.filter((item) => item.due_date === iso).length;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSelectedDay(iso)}
                        aria-pressed={selectedDay === iso}
                        className="min-h-24 border-r border-b p-2 text-left text-sm hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-accent"
                      >
                        <span
                          className={
                            day.getMonth() === month.getMonth()
                              ? ""
                              : "text-muted-foreground"
                          }
                        >
                          {day.getDate()}
                        </span>
                        {count > 0 && (
                          <span className="mt-2 block rounded bg-primary/10 px-1 text-xs">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <aside className="rounded-xl border bg-card p-4">
                <h2 className="font-medium">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: locale === "kk" ? "short" : "medium",
                  }).format(new Date(`${selectedDay}T00:00:00`))}
                </h2>
                {meetings.data?.items
                  .filter(
                    (meeting) => meeting.started_at.slice(0, 10) === selectedDay
                  )
                  .map((meeting) => (
                    <Link
                      className="mt-3 block text-sm underline"
                      key={meeting.id}
                      to="/meetings/$meetingId"
                      params={{ meetingId: meeting.id }}
                    >
                      {meeting.title}
                    </Link>
                  ))}
                {tasks
                  .filter((item) => item.due_date === selectedDay)
                  .map((item) => (
                    <Link
                      className="mt-3 block text-sm underline"
                      key={item.id}
                      to="/meetings/$meetingId"
                      params={{ meetingId: item.meetingId }}
                    >
                      {item.text}
                    </Link>
                  ))}
              </aside>
            </div>
          )}

          {kind === "people" && (
            <>
              <label className="relative block max-w-sm">
                <span className="sr-only">{t.search}</span>
                <Search
                  className="pointer-events-none absolute top-2.5 left-3 size-4"
                  aria-hidden="true"
                />
                <Input
                  className="pl-9"
                  type="search"
                  placeholder={t.search}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <div className="overflow-hidden rounded-xl border bg-card">
                {people
                  .filter((person) =>
                    `${person.name} ${person.role ?? ""}`
                      .toLocaleLowerCase()
                      .includes(search.toLocaleLowerCase())
                  )
                  .map((person) => (
                    <Link
                      key={person.id}
                      className="flex items-center gap-3 border-b p-4 last:border-0 hover:bg-muted/40"
                      to="/people/$personId"
                      params={{ personId: person.id }}
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-xs font-semibold">
                        {person.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span>
                        <strong className="block font-medium">
                          {person.name}
                        </strong>
                        <small className="text-muted-foreground">
                          {person.role ?? t.unknown} ·{" "}
                          {person.meetingIds.length} {t.meetingCount}
                        </small>
                      </span>
                    </Link>
                  ))}
                {!people.length && (
                  <p className="p-6 text-sm text-muted-foreground">
                    {t.noItems}
                  </p>
                )}
              </div>
            </>
          )}

          {kind === "briefing" && (
            <div className="space-y-4">
              {reviewQueries
                .flatMap((query, index) =>
                  query.data
                    ? [
                        {
                          meeting: meetings.data?.items[index],
                          review: query.data,
                        },
                      ]
                    : []
                )
                .map(
                  ({ meeting, review }) =>
                    meeting && (
                      <section
                        key={meeting.id}
                        className="rounded-xl border bg-card p-5"
                      >
                        <h2 className="font-medium">
                          <Link
                            className="underline"
                            to="/meetings/$meetingId"
                            params={{ meetingId: meeting.id }}
                          >
                            {meeting.title}
                          </Link>
                        </h2>
                        {review.source === "mock" && (
                          <p className="mt-2 text-xs text-amber-700">
                            {t.sample}
                          </p>
                        )}
                        <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
                          {review.summary.topics.map((item, index) => (
                            <li key={index}>{item.text}</li>
                          ))}
                        </ul>
                        <h3 className="mt-3 text-sm font-semibold">
                          {t.decisions}
                        </h3>
                        <ul className="list-inside list-disc text-sm">
                          {review.summary.decisions.map((item, index) => (
                            <li key={index}>{item.text}</li>
                          ))}
                        </ul>
                        <h3 className="mt-3 text-sm font-semibold">
                          {t.openQuestions}
                        </h3>
                        <ul className="list-inside list-disc text-sm">
                          {review.summary.open_questions.map((item, index) => (
                            <li key={index}>{item.text}</li>
                          ))}
                        </ul>
                      </section>
                    )
                )}
              {!reviewQueries.some((query) => query.data) && (
                <p className="rounded-xl border p-6 text-sm text-muted-foreground">
                  {t.noResult}
                </p>
              )}
            </div>
          )}
        </>
      )}
      {kind !== "calendar" && kind !== "people" && (
        <p className="text-xs text-muted-foreground">{t.meetingsHelp}</p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function readDemoAccess(key: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return Object.fromEntries(
        Object.entries(parsed).filter(
          ([role, value]) =>
            ["user", "admin"].includes(role) && typeof value === "boolean"
        )
      );
  } catch {
    localStorage.removeItem(key);
  }
  return {};
}

function DemoExtras({
  kind,
  title,
  search,
  setSearch,
  meetings,
  reviews,
  people,
  loading,
  error,
  retry,
}: {
  kind: SurfaceKind;
  title: string;
  search: string;
  setSearch: (value: string) => void;
  meetings: { id: string; title: string }[];
  reviews: (
    | {
        segments: { id: string; start_ms: number; text: string }[];
        summary: {
          decisions: { text: string; source_segment_ids: string[] }[];
        };
      }
    | null
    | undefined
  )[];
  people: {
    id: string;
    name: string;
    role: string | null;
    meetingIds: string[];
  }[];
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  const locale = useLocale();
  const { data: session } = authClient.useSession();
  const [question, setQuestion] = useState("");
  const accessKey = `saint-tibo-demo-access:${session?.user.id ?? ""}`;
  const [accessState, setAccessState] = useState<{
    key: string;
    values: Record<string, boolean>;
  }>({ key: "", values: {} });
  const access =
    accessState.key === accessKey
      ? accessState.values
      : readDemoAccess(accessKey);
  const questions = reviews.flatMap(
    (review, index) =>
      review?.summary.decisions.slice(0, 1).map((decision) => ({
        question: {
          ru: `Что решили на встрече «${meetings[index]?.title}»?`,
          kk: `«${meetings[index]?.title}» кездесуінде не шешілді?`,
          en: `What was decided at “${meetings[index]?.title}”?`,
        }[locale],
        answer: decision.text,
        meetingId: meetings[index]?.id,
        segment: review.segments.find((segment) =>
          decision.source_segment_ids.includes(segment.id)
        ),
      })) ?? []
  );
  const answer = questions.find((item) => item.question === question);
  const users = people.slice(0, 8).map((person, index) => ({
    ...person,
    email: `demo${index + 1}@synthetic.invalid`,
    role: index === 0 ? "admin" : "user",
  }));
  const label = {
    ru: "Синтетические данные",
    kk: "Синтетикалық деректер",
    en: "Synthetic data",
  }[locale];
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
        {label}
      </p>
      {loading ? (
        <output className="block rounded-xl border p-6">
          {{ ru: "Загрузка…", kk: "Жүктелуде…", en: "Loading…" }[locale]}
        </output>
      ) : error ? (
        <div role="alert">
          <p>
            {
              {
                ru: "Ошибка загрузки",
                kk: "Жүктеу қатесі",
                en: "Loading failed",
              }[locale]
            }
          </p>
          <Button onClick={retry}>↻</Button>
        </div>
      ) : kind === "ask" ? (
        <div className="space-y-4">
          <label className="block space-y-2">
            <span>{{ ru: "Вопрос", kk: "Сұрақ", en: "Question" }[locale]}</span>
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {questions.slice(0, 5).map((item) => (
              <Button
                key={item.question}
                variant="outline"
                onClick={() => setQuestion(item.question)}
              >
                {item.question}
              </Button>
            ))}
          </div>
          {question && (
            <div className="rounded-xl border bg-card p-5">
              {answer ? (
                <>
                  <p>{answer.answer}</p>
                  {answer.segment && answer.meetingId && (
                    <Link
                      className="mt-2 inline-block text-primary underline"
                      to="/meetings/$meetingId"
                      params={{ meetingId: answer.meetingId }}
                    >
                      {
                        meetings.find(
                          (meeting) => meeting.id === answer.meetingId
                        )?.title
                      }{" "}
                      · {Math.floor(answer.segment.start_ms / 1000)} с ·{" "}
                      {answer.segment.text}
                    </Link>
                  )}
                </>
              ) : (
                <p>
                  {
                    {
                      ru: "В демо нет ответа на этот вопрос.",
                      kk: "Демода бұл сұраққа жауап жоқ.",
                      en: "The demo has no answer to this question.",
                    }[locale]
                  }
                </p>
              )}
            </div>
          )}
        </div>
      ) : kind === "adminAccess" ? (
        <div className="space-y-3">
          {["user", "admin"].map((role) => (
            <div key={role} className="rounded-xl border bg-card p-4">
              <strong>{role}</strong>
              <p className="text-sm">
                {role === "admin"
                  ? "users:read · access:read · meeting:write"
                  : "profile:read · meeting:read"}
              </p>
              <label className="mt-2 flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={access[role] ?? role === "admin"}
                  onChange={(event) => {
                    const next = { ...access, [role]: event.target.checked };
                    setAccessState({ key: accessKey, values: next });
                    localStorage.setItem(accessKey, JSON.stringify(next));
                  }}
                />
                {
                  { ru: "Демо-доступ", kk: "Демо рұқсаты", en: "Demo access" }[
                    locale
                  ]
                }
              </label>
            </div>
          ))}
        </div>
      ) : (
        <>
          <Input
            type="search"
            aria-label="Search"
            placeholder="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="rounded-xl border bg-card">
            {kind === "adminUsers"
              ? users
                  .filter((user) =>
                    `${user.name} ${user.email}`
                      .toLowerCase()
                      .includes(search.toLowerCase())
                  )
                  .map((user) => (
                    <details key={user.id} className="border-b p-4">
                      <summary className="cursor-pointer">
                        {user.name} · {user.role}
                      </summary>
                      <p className="mt-2 text-sm">{user.email}</p>
                    </details>
                  ))
              : people
                  .filter((person) =>
                    person.name.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((person) => (
                    <Link
                      key={person.id}
                      to="/people/$personId"
                      params={{ personId: person.id }}
                      className="block border-b p-4 hover:bg-muted"
                    >
                      {person.name} · {person.role} · {person.meetingIds.length}
                    </Link>
                  ))}
            {!people.filter((person) =>
              person.name.toLowerCase().includes(search.toLowerCase())
            ).length && <p className="p-4">—</p>}
          </div>
        </>
      )}
    </section>
  );
}
