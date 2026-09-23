import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "#/shared/ui/shadcn/button";
import { Input } from "#/shared/ui/shadcn/input";

import { saveMeeting } from "../api/meetings";
import { useCopy } from "../lib/copy";

const defaultZone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Almaty";
const initialDateTime = new Date(
  Date.now() - new Date().getTimezoneOffset() * 60000
)
  .toISOString()
  .slice(0, 16);

/** Interpret the entered wall clock in the selected IANA zone. */
function zonedTime(value: string, zone: string) {
  const [date, time] = value.split("T");
  if (!date || !time) throw new Error("Invalid meeting date");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  let instant = wall;
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(instant)
        .map((part) => [part.type, Number(part.value)])
    );
    const observed = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute
    );
    instant += wall - observed;
  }
  return new Date(instant).toISOString();
}

export function CreateMeetingPage() {
  const t = useCopy();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [startedAt, setStartedAt] = useState(initialDateTime);
  const [timezone, setTimezone] = useState(defaultZone);
  const [error, setError] = useState("");
  const mutation = useMutation({ mutationFn: saveMeeting });

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link
        className="text-sm text-muted-foreground hover:underline"
        to="/meetings"
      >
        ← {t.back}
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{t.newMeeting}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.notice}</p>
      </header>
      <form
        className="space-y-5 rounded-xl border bg-card p-5 sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          mutation.mutate(
            {
              title: title.trim(),
              started_at: zonedTime(startedAt, timezone),
              timezone,
            },
            {
              onSuccess: (meeting) => {
                void client.invalidateQueries({ queryKey: ["meetings"] });
                void navigate({
                  to: "/meetings/$meetingId",
                  params: { meetingId: meeting.id },
                });
              },
              onError: (reason) =>
                setError(reason instanceof Error ? reason.message : t.error),
            }
          );
        }}
      >
        <h2 className="font-medium">{t.meetingInfo}</h2>
        <label className="block space-y-1.5 text-sm font-medium">
          <span>{t.title}</span>
          <Input
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm font-medium">
            <span>{t.startedAt}</span>
            <Input
              required
              type="datetime-local"
              value={startedAt}
              onChange={(event) => setStartedAt(event.target.value)}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>{t.timezone}</span>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            >
              {[
                ...new Set([
                  defaultZone,
                  "Asia/Almaty",
                  "Asia/Astana",
                  "Europe/Moscow",
                  "UTC",
                ]),
              ].map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={mutation.isPending || !title.trim()}>
            {mutation.isPending ? t.loading : t.createMeeting}
          </Button>
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link to="/meetings" />}
          >
            {t.cancel}
          </Button>
        </div>
      </form>
    </section>
  );
}
