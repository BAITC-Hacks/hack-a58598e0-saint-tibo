import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";

export const BrandLockup = () => {
  const locale = useLocale();

  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <img
        src="/brand-logo.svg"
        alt="Самрук-Қазына"
        className="h-[42px] w-auto max-w-[132px] shrink-0 object-contain"
      />
      <span aria-hidden="true" className="h-9 w-px shrink-0 bg-brand-gold" />
      <div className="min-w-0">
        <span className="block text-xl leading-[1.1] font-bold tracking-[0.01em] text-brand-navy">
          Хаттама
        </span>
        <span className="block text-xs text-muted-foreground">
          {m.brand_subtitle({}, { locale })}
        </span>
      </div>
    </div>
  );
};
