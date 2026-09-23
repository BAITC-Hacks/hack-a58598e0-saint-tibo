import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";

export const HomePage = () => {
  const locale = useLocale();
  return (
    <section className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">
        {m.home_page({}, { locale })}
      </h1>
      <p className="text-muted-foreground">
        {m.home_description({}, { locale })}
      </p>
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        {m.home_status({}, { locale })}
      </p>
    </section>
  );
};
