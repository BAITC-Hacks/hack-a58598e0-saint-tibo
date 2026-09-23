import { useState } from "react";

import {
  apiErrorMessage,
  askOrganizationQuestion,
  backendClient,
} from "#/shared/api";
import type { Answer } from "#/shared/api";
import { useLocale } from "#/shared/lib/locales";
import { Button } from "#/shared/ui/shadcn/button";
import { Input } from "#/shared/ui/shadcn/input";

const copy = {
  ru: {
    title: "Вопросы по оргсправочнику",
    scope: "Ответы по участникам и ролям в доступных вам встречах.",
    placeholder: "Например: кто участвовал в обсуждении проекта?",
    ask: "Спросить",
    pending: "Ищем ответ…",
    unavailable: "Не удалось получить ответ. Попробуйте позже.",
    source: "Основано на {people} участниках из {meetings} встреч.",
    provider:
      "Сейчас анализ выполняется через внешний API. Данные участников отправляются провайдеру; затем систему переключат на локальные модели.",
  },
  kk: {
    title: "Ұйым анықтамалығы бойынша сұрақтар",
    scope:
      "Сізге қолжетімді кездесулердегі қатысушылар мен рөлдер бойынша жауаптар.",
    placeholder: "Мысалы: жоба талқылауына кім қатысты?",
    ask: "Сұрау",
    pending: "Жауап ізделуде…",
    unavailable: "Жауап алу мүмкін болмады. Кейінірек қайталаңыз.",
    source: "{meetings} кездесудегі {people} қатысушы негізінде.",
    provider:
      "Қазір талдау сыртқы API арқылы орындалады. Қатысушылар деректері провайдерге жіберіледі; кейін жүйе жергілікті модельдерге көшеді.",
  },
  en: {
    title: "Ask the organization directory",
    scope: "Answers about participants and roles in meetings you can access.",
    placeholder: "For example: who joined the project discussion?",
    ask: "Ask",
    pending: "Finding an answer…",
    unavailable: "Could not get an answer. Please try again later.",
    source: "Based on {people} participants in {meetings} meetings.",
    provider:
      "Analysis currently uses an external API. Participant data is sent to that provider; the system will later switch to local models.",
  },
} as const;

export function OrgAskPage() {
  const t = copy[useLocale()];
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 3 || pending) return;
    setPending(true);
    setAnswer(null);
    setError("");
    try {
      const result = await askOrganizationQuestion({
        client: backendClient,
        body: { query: query.trim() },
      });
      if (!result.data || result.error)
        throw new Error(apiErrorMessage(result.error, t.unavailable));
      setAnswer(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.unavailable);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="text-sm text-muted-foreground">{t.scope}</p>
      <p className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        {t.provider}
      </p>
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => void submit(event)}
      >
        <Input
          aria-label={t.title}
          maxLength={500}
          minLength={3}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.placeholder}
          required
          value={query}
        />
        <Button disabled={pending || query.trim().length < 3} type="submit">
          {pending ? t.pending : t.ask}
        </Button>
      </form>
      {error && (
        <p
          className="rounded-lg border border-destructive/50 p-4 text-sm"
          role="alert"
        >
          {error}
        </p>
      )}
      {answer && (
        <output className="block space-y-3 rounded-xl border bg-card p-5">
          <p className="whitespace-pre-wrap">{answer.answer}</p>
          <p className="text-xs text-muted-foreground">
            {t.source
              .replace("{people}", String(answer.participant_count))
              .replace("{meetings}", String(answer.meeting_count))}
          </p>
        </output>
      )}
    </section>
  );
}
