import { ClientOnly } from "@tanstack/react-router";
import { Accessibility, X } from "lucide-react";

import {
  A11Y_DEFAULTS,
  FONT_SCALES,
  IMAGE_MODES,
  updateA11ySettings,
  useA11ySettings,
} from "#/shared/lib/a11y-settings";
import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";
import { Button } from "#/shared/ui/shadcn/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "#/shared/ui/shadcn/dialog";

const A11yPanelContent = () => {
  const locale = useLocale();
  const settings = useA11ySettings();
  const imageLabels = {
    normal: m.a11y_images_normal,
    grayscale: m.a11y_images_grayscale,
    hidden: m.a11y_images_hidden,
  };
  const toggles = [
    { key: "contrast", label: m.a11y_contrast },
    { key: "spacing", label: m.a11y_spacing },
    { key: "reduceMotion", label: m.a11y_motion },
    { key: "speech", label: m.a11y_speech },
  ] as const;
  const speechSupported = "speechSynthesis" in window;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={m.a11y_open({}, { locale })}
          />
        }
      >
        <Accessibility aria-hidden="true" />
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b p-4 sm:p-6">
          <DialogTitle className="min-w-0 leading-snug">
            {m.a11y_open({}, { locale })}
          </DialogTitle>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={m.a11y_close({}, { locale })}
              />
            }
          >
            <X aria-hidden="true" />
          </DialogClose>
        </div>
        <div className="grid min-h-0 gap-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <fieldset className="min-w-0 space-y-2">
            <legend className="mb-2 font-medium">
              {m.a11y_font_size({}, { locale })}
            </legend>
            <div className="flex flex-wrap gap-2">
              {FONT_SCALES.map((scale) => (
                <Button
                  key={scale}
                  className="flex-auto"
                  variant={
                    settings.fontScale === scale ? "secondary" : "outline"
                  }
                  aria-pressed={settings.fontScale === scale}
                  onClick={() => updateA11ySettings({ fontScale: scale })}
                >
                  {scale * 100}%
                </Button>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0 space-y-2">
            <legend className="mb-2 font-medium">
              {m.a11y_scheme({}, { locale })}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="h-auto min-h-10 max-w-full min-w-0 py-2 whitespace-normal aria-pressed:bg-secondary aria-pressed:font-semibold"
                variant="outline"
                aria-pressed={settings.scheme === "default"}
                onClick={() => updateA11ySettings({ scheme: "default" })}
              >
                {m.a11y_scheme_default({}, { locale })}
              </Button>
              <Button
                className="h-auto min-h-10 max-w-full min-w-0 py-2 whitespace-normal aria-pressed:bg-secondary aria-pressed:font-semibold"
                variant="outline"
                aria-pressed={settings.scheme === "contrast"}
                onClick={() => updateA11ySettings({ scheme: "contrast" })}
              >
                {m.a11y_scheme_contrast({}, { locale })}
              </Button>
            </div>
          </fieldset>
          <fieldset className="min-w-0 space-y-2">
            <legend className="mb-2 font-medium">
              {m.a11y_images({}, { locale })}
            </legend>
            <div className="flex flex-wrap gap-2">
              {IMAGE_MODES.map((images) => (
                <Button
                  className="h-auto min-h-10 max-w-full min-w-0 py-2 whitespace-normal aria-pressed:bg-secondary aria-pressed:font-semibold"
                  key={images}
                  variant="outline"
                  aria-pressed={settings.images === images}
                  onClick={() => updateA11ySettings({ images })}
                >
                  {imageLabels[images]({}, { locale })}
                </Button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-2">
            {toggles.map(({ key, label }) => (
              <label
                key={key}
                className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md border p-3 has-disabled:cursor-default has-disabled:opacity-60"
              >
                <span>{label({}, { locale })}</span>
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-primary"
                  checked={settings[key]}
                  disabled={key === "speech" && !speechSupported}
                  onChange={(event) =>
                    updateA11ySettings({ [key]: event.target.checked })
                  }
                />
              </label>
            ))}
            <p className="text-sm text-muted-foreground">
              {speechSupported
                ? m.a11y_speech_help({}, { locale })
                : m.a11y_speech_unavailable({}, { locale })}
            </p>
          </div>
          <Button
            className="h-auto min-h-11 py-2 whitespace-normal"
            variant="outline"
            onClick={() => updateA11ySettings(A11Y_DEFAULTS)}
          >
            {m.a11y_reset({}, { locale })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const A11yPanel = () => (
  <ClientOnly>
    <A11yPanelContent />
  </ClientOnly>
);
