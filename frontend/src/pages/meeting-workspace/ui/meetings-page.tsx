import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Plus, Search } from "lucide-react";
import { useState } from "react";

import { useLocale } from "#/shared/lib/locales";
import { Button } from "#/shared/ui/shadcn/button";
import { Input } from "#/shared/ui/shadcn/input";

import { meetingsQuery } from "../api/meetings";
import { useCopy } from "../lib/copy";

export function MeetingsPage() {
  const t = useCopy();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const meetings = useQuery(meetingsQuery(0));
  const visible = meetings.data?.items.filter((meeting) =>
    meeting.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  );

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.meetings}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.meetingsHelp}</p>
        </div>
        <Button nativeButton={false} render={<Link to="/meetings/new" />}>
          <Plus aria-hidden="true" /> {t.newMeeting}
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm text-muted-foreground">{t.meetings}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {meetings.data?.total ?? "—"}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 sm:col-span-2">
          <p className="text-sm text-muted-foreground">{t.notice}</p>
        </div>
      </div>

      <label className="relative block max-w-xl">
        <span className="sr-only">{t.search}</span>
        <Search
          className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          type="search"
          value={search}
          placeholder={t.searchMeetings}
          onChange={(event) => {
            setSearch(event.target.value);
            setOffset(0);
          }}
        />
      </label>

      {meetings.isPending ? (
        <output className="block rounded-xl border p-8 text-muted-foreground">
          {t.loading}
        </output>
      ) : meetings.isError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 p-8"
        >
          <p>{t.error}</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void meetings.refetch()}
          >
            {t.retry}
          </Button>
        </div>
      ) : visible?.length ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          {visible.slice(offset, offset + 10).map((meeting) => (
            <Link
              className="flex flex-wrap items-center justify-between gap-3 border-b p-4 transition-colors last:border-0 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
              key={meeting.id}
              to="/meetings/$meetingId"
              params={{ meetingId: meeting.id }}
            >
              <div className="min-w-0">
                <div className="font-medium">{meeting.title}</div>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  <time dateTime={meeting.started_at}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: meeting.timezone,
                    }).format(new Date(meeting.started_at))}
                  </time>
                  <span>· {meeting.timezone}</span>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">→</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <CalendarDays
            className="mx-auto size-8 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="mt-3 font-medium">
            {search ? t.noItems : t.noMeetings}
          </h2>
          {!search && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t.noMeetingsHelp}
            </p>
          )}
        </div>
      )}

      {!!visible && visible.length > 10 && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 10))}
          >
            ←
          </Button>
          <Button
            variant="outline"
            disabled={offset + 10 >= visible.length}
            onClick={() => setOffset(offset + 10)}
          >
            →
          </Button>
        </div>
      )}
    </section>
  );
}
