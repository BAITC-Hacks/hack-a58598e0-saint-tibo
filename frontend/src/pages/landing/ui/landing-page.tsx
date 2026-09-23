import { Link } from "@tanstack/react-router";
import { ArrowRight, AudioLines, FileCheck2, FileText } from "lucide-react";

import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";
import { A11yPanel } from "#/shared/ui/a11y-panel";
import { BrandLockup } from "#/shared/ui/brand-lockup";
import LocaleSwitcher from "#/shared/ui/locale-switcher";
import { Button } from "#/shared/ui/shadcn/button";
import ThemeToggle from "#/shared/ui/theme-toggle";

const readme =
  "https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/blob/dev/README.md";
const demoGuide =
  "https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/blob/dev/DEMO.md";

export function LandingPage() {
  const locale = useLocale();
  const copy = { locale };
  const steps = [
    m.landing_step_upload({}, copy),
    m.landing_step_transcript({}, copy),
    m.landing_step_speakers({}, copy),
    m.landing_step_actions({}, copy),
    m.landing_step_evidence({}, copy),
    m.landing_step_review({}, copy),
    m.landing_step_export({}, copy),
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="brand-header border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <BrandLockup />
          <nav
            aria-label={m.app_navigation({}, copy)}
            className="ml-auto hidden items-center gap-5 text-sm font-medium md:flex"
          >
            <a href="#flow" className="underline-offset-4 hover:underline">
              {m.landing_nav_flow({}, copy)}
            </a>
            <a href="#trust" className="underline-offset-4 hover:underline">
              {m.landing_nav_trust({}, copy)}
            </a>
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-1 md:ml-2">
            <LocaleSwitcher />
            <ThemeToggle />
            <A11yPanel />
          </div>
        </div>
      </header>
      <div aria-hidden="true" className="h-[3px] bg-brand-gold" />

      <main id="content">
        <section className="relative overflow-hidden border-b border-border px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -right-20 size-80 rounded-full border-[44px] border-brand-gold/10 sm:size-[34rem]"
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] lg:gap-16">
            <div className="min-w-0">
              <p className="mb-4 text-xs font-bold tracking-[0.18em] text-brand-gold-deep uppercase">
                {m.landing_eyebrow({}, copy)}
              </p>
              <h1 className="max-w-3xl text-4xl leading-[1.08] font-bold tracking-tight text-balance text-primary sm:text-5xl xl:text-6xl">
                {m.landing_title({}, copy)}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                {m.landing_intro({}, copy)}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  nativeButton={false}
                  size="lg"
                  className="h-auto min-h-11 gap-2 px-5 py-3 whitespace-normal"
                  render={<Link to="/meetings" />}
                >
                  {m.landing_open_demo({}, copy)}{" "}
                  <ArrowRight aria-hidden="true" />
                </Button>
                <Button
                  nativeButton={false}
                  size="lg"
                  variant="outline"
                  className="h-auto min-h-11 px-5 py-3 whitespace-normal"
                  render={
                    <a href={readme} aria-label={m.landing_readme({}, copy)} />
                  }
                >
                  {m.landing_readme({}, copy)}
                </Button>
              </div>
              <div className="mt-10 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
                <p className="border-l-2 border-brand-gold pl-4 text-sm leading-relaxed">
                  {m.landing_secretary({}, copy)}
                </p>
                <p className="border-l-2 border-brand-gold pl-4 text-sm leading-relaxed">
                  {m.landing_manager({}, copy)}
                </p>
              </div>
            </div>

            <div className="min-w-0">
              <div className="relative border border-border bg-card shadow-[0_20px_50px_rgba(23,51,93,0.1)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1">
                <div aria-hidden="true" className="h-1 bg-brand-gold" />
                <div className="p-5 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
                    <div>
                      <p className="text-xs font-bold tracking-wider text-brand-gold-deep uppercase">
                        {m.landing_sample_label({}, copy)}
                      </p>
                      <h2 className="mt-2 text-xl font-bold text-foreground">
                        {m.landing_sample_title({}, copy)}
                      </h2>
                    </div>
                    <FileText
                      className="size-6 text-brand-gold-deep"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-6 grid gap-4">
                    <div className="border-l-2 border-primary bg-muted px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        00:42 · {m.landing_sample_source({}, copy)}
                      </p>
                      <p className="mt-1 font-medium">
                        “{m.landing_sample_line({}, copy)}”
                      </p>
                    </div>
                    <div className="border border-border p-4">
                      <div className="flex items-start gap-3">
                        <FileCheck2
                          className="mt-0.5 size-5 shrink-0 text-status-success"
                          aria-hidden="true"
                        />
                        <p className="font-bold">
                          {m.landing_sample_action({}, copy)}
                        </p>
                      </div>
                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">
                            {m.landing_sample_owner({}, copy)}
                          </dt>
                          <dd className="mt-1 font-medium">
                            {m.landing_sample_unknown({}, copy)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">
                            {m.landing_sample_due({}, copy)}
                          </dt>
                          <dd className="mt-1 font-medium">
                            {m.landing_sample_due_value({}, copy)}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-4 inline-flex items-center gap-2 border border-status-success/30 bg-status-success-bg px-3 py-1.5 text-xs font-semibold text-status-success">
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-status-success"
                        />
                        {m.landing_sample_review({}, copy)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                    {m.landing_sample_note({}, copy)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="flow"
          aria-labelledby="flow-title"
          className="scroll-mt-8 px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <AudioLines
                className="mb-4 size-7 text-brand-gold-deep"
                aria-hidden="true"
              />
              <h2
                id="flow-title"
                className="text-3xl font-bold tracking-tight text-primary sm:text-4xl"
              >
                {m.landing_flow_title({}, copy)}
              </h2>
              <p className="mt-4 text-muted-foreground">
                {m.landing_flow_intro({}, copy)}
              </p>
            </div>
            <ol className="mt-9 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <li
                  key={step}
                  className={`group min-w-0 bg-card p-5 hover:bg-muted motion-safe:transition-colors motion-safe:duration-200 sm:p-6 ${index === steps.length - 1 ? "lg:col-span-2" : ""}`}
                >
                  <span className="text-xs font-bold tracking-widest text-brand-gold-deep tabular-nums">
                    {String(index + 1).padStart(2, "0")} / 07
                  </span>
                  <p className="mt-5 text-lg leading-snug font-semibold">
                    {step}
                  </p>
                  {index === 2 && (
                    <p className="mt-3 inline-block border border-border px-2 py-1 text-xs font-semibold text-muted-foreground">
                      {m.landing_under_validation({}, copy)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
              {m.landing_speakers_note({}, copy)}
            </p>
          </div>
        </section>

        <section
          id="trust"
          aria-labelledby="trust-title"
          className="scroll-mt-8 border-y border-border bg-card px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
        >
          <div className="mx-auto max-w-7xl">
            <h2
              id="trust-title"
              className="text-3xl font-bold tracking-tight text-primary sm:text-4xl"
            >
              {m.landing_trust_title({}, copy)}
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                m.landing_trust_auth({}, copy),
                m.landing_trust_local({}, copy),
                m.landing_trust_review({}, copy),
              ].map((item, index) => (
                <div
                  key={item}
                  className="border-t-2 border-brand-gold bg-background p-5 sm:p-6"
                >
                  <span className="text-xs font-bold text-brand-gold-deep tabular-nums">
                    0{index + 1}
                  </span>
                  <p className="mt-3 leading-relaxed font-medium">{item}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 max-w-4xl text-sm leading-relaxed text-muted-foreground">
              {m.landing_trust_note({}, copy)}
            </p>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 border-t-2 border-brand-gold bg-primary px-6 py-9 text-primary-foreground sm:px-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold sm:text-3xl">
                {m.landing_cta_title({}, copy)}
              </h2>
              <p className="mt-3 leading-relaxed opacity-90">
                {m.landing_cta_intro({}, copy)}
              </p>
            </div>
            <Button
              nativeButton={false}
              variant="secondary"
              size="lg"
              className="h-auto min-h-11 shrink-0 px-5 py-3 whitespace-normal"
              render={<Link to="/meetings" />}
            >
              {m.landing_open_demo({}, copy)} <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8 text-sm sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <span className="font-bold text-primary">Хаттама</span>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a className="underline underline-offset-4" href={readme}>
              {m.landing_readme({}, copy)}
            </a>
            <a className="underline underline-offset-4" href={demoGuide}>
              {m.landing_demo_guide({}, copy)}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
