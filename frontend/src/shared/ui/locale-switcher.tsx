import { ClientOnly } from "@tanstack/react-router";

import { m } from "#/shared/lib/i18n/messages";
import { locales } from "#/shared/lib/i18n/runtime";
import { changeLocale, localeLabels, useLocale } from "#/shared/lib/locales";

import { Button } from "./shadcn/button";

const LocaleSwitcherContent = () => {
  const locale = useLocale();
  return (
    <fieldset className="flex shrink-0 gap-1">
      <legend className="sr-only">{m.language_label({}, { locale })}</legend>
      {locales.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={option === locale ? "secondary" : "ghost"}
          aria-pressed={option === locale}
          aria-label={localeLabels[option].name}
          lang={option}
          onClick={() => {
            void changeLocale(option);
          }}
        >
          {localeLabels[option].short}
        </Button>
      ))}
    </fieldset>
  );
};

const LocaleSwitcher = () => (
  <ClientOnly>
    <LocaleSwitcherContent />
  </ClientOnly>
);

export default LocaleSwitcher;
