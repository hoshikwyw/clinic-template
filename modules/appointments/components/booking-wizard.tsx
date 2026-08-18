"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@ui/primitives/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@ui/primitives/card";
import { FormRenderer, type FormSchema } from "@form-engine";
import {
  getAvailableSlots,
  getServiceProviders,
  createAppointment,
  type BookingResult,
  type BookableProvider,
} from "../server/booking";
import type { ProviderDaySlots, ProviderSlot } from "../dto";

export interface BookingService {
  id: string;
  name: string;
  durationMinutes: number;
  price?: number;
  description?: string;
}

export interface BookingWizardProps {
  services: BookingService[];
  /** canonical contact fields (names must be fullName/phone/email); labels vary by clinic */
  contactForm: FormSchema;
  intakeForm: FormSchema;
  timeZone: string;
  currency: string;
  /** preselect a service (e.g. from a "book this service" link) and skip to time */
  initialServiceId?: string;
}

type StepKey = "service" | "when" | "details" | "intake" | "review";

export function BookingWizard({
  services,
  contactForm,
  intakeForm,
  timeZone,
  currency,
  initialServiceId,
}: BookingWizardProps) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const hasIntake = intakeForm.length > 0;
  const steps: StepKey[] = [
    "service",
    "when",
    "details",
    ...(hasIntake ? (["intake"] as StepKey[]) : []),
    "review",
  ];

  const [stepIndex, setStepIndex] = React.useState(0);
  const [serviceId, setServiceId] = React.useState<string | null>(null);
  const [days, setDays] = React.useState<ProviderDaySlots[] | null>(null);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [slot, setSlot] = React.useState<ProviderSlot | null>(null);
  // Providers who perform the chosen service. `null` provider = "any available",
  // which lets the server assign whoever is free — the common case, and the one
  // that keeps the most slots on screen.
  const [providers, setProviders] = React.useState<BookableProvider[]>([]);
  const [providerId, setProviderId] = React.useState<string | null>(null);
  const [contact, setContact] = React.useState<Record<string, unknown> | null>(
    null
  );
  const [intake, setIntake] = React.useState<Record<string, unknown> | null>(
    null
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<BookingResult | null>(null);

  // Preselect a service passed in (e.g. from a home service card), skipping to
  // the time step. Runs once.
  const didInit = React.useRef(false);
  React.useEffect(() => {
    if (didInit.current) return;
    if (initialServiceId && services.some((s) => s.id === initialServiceId)) {
      didInit.current = true;
      void chooseService(initialServiceId);
    }
  }, [initialServiceId, services]);

  const step = steps[stepIndex];
  const service = services.find((s) => s.id === serviceId) ?? null;

  function next() {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function back() {
    setStepIndex((i) => Math.max(i - 1, 0));
    setResult(null); // drop any stale "slot taken" error when leaving review
  }

  function money(n?: number) {
    return n ? `${n.toLocaleString()} ${currency}` : "";
  }

  function formatWhen(iso: string) {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  }

  /**
   * Translate a booking failure. Keys off the server's machine-readable `code`
   * and falls back to its English `error` only for a result produced before
   * codes existed — the whole rest of this app is translated, so a Burmese
   * patient must not hit an English sentence at the final step.
   */
  function bookingErrorMessage(res: BookingResult): string {
    if (!res.code) return res.error ?? t("errorGeneric");
    if (res.code === "rateLimited" && res.retryAfterSeconds) {
      return t("errorRateLimitedIn", {
        minutes: Math.max(1, Math.ceil(res.retryAfterSeconds / 60)),
      });
    }
    return t(`error_${res.code}`);
  }

  async function chooseService(id: string) {
    setServiceId(id);
    setSlot(null);
    setSelectedDate(null);
    setDays(null);
    setProviderId(null);
    setProviders([]);
    setLoadingSlots(true);
    setStepIndex(1);
    try {
      // In parallel: the clinicians who perform this service, and every time
      // any of them is free. One round trip either way.
      const [d, p] = await Promise.all([
        getAvailableSlots(id),
        getServiceProviders(id),
      ]);
      setProviders(p);
      setDays(d);
      setSelectedDate(d[0]?.date ?? null);
    } finally {
      setLoadingSlots(false);
    }
  }

  /** Narrow (or widen) availability to one clinician. `null` = any available. */
  async function chooseProvider(id: string | null) {
    if (!serviceId) return;
    setProviderId(id);
    setSlot(null);
    setLoadingSlots(true);
    try {
      const d = await getAvailableSlots(serviceId, id ?? undefined);
      setDays(d);
      // Keep the day the patient was looking at when it still has times.
      setSelectedDate((prev) =>
        prev && d.some((day) => day.date === prev) ? prev : (d[0]?.date ?? null)
      );
    } finally {
      setLoadingSlots(false);
    }
  }

  async function confirm() {
    if (!service || !slot) return;
    setSubmitting(true);
    try {
      const res = await createAppointment({
        serviceId: service.id,
        startIso: slot.startIso,
        providerId: providerId ?? undefined,
        contact: {
          fullName: String(contact?.fullName ?? ""),
          phone: String(contact?.phone ?? ""),
          email: contact?.email ? String(contact.email) : undefined,
        },
        intake: intake ?? undefined,
      });
      setResult(res);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStepIndex(0);
    setServiceId(null);
    setDays(null);
    setSelectedDate(null);
    setSlot(null);
    setProviders([]);
    setProviderId(null);
    setContact(null);
    setIntake(null);
    setResult(null);
  }

  // ---- Confirmation screen -------------------------------------------------
  if (result?.ok) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <p className="text-3xl">✓</p>
          <h2 className="text-xl font-semibold text-primary">
            {t("requested")}
          </h2>
          <p className="text-muted-foreground">
            {result.serviceName} ·{" "}
            {result.startIso ? formatWhen(result.startIso) : ""}
          </p>
          {result.providerName && (
            <p className="text-muted-foreground">
              {t("withProvider", { name: result.providerName })}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{t("contactNote")}</p>
          <Button onClick={reset} variant="outline" size="lg" className="mt-2">
            {t("bookAnother")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const stepTitles: Record<StepKey, string> = {
    service: t("stepService"),
    when: t("stepWhen"),
    details: t("stepDetails"),
    intake: t("stepIntake"),
    review: t("stepReview"),
  };

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{stepTitles[step]}</span>
          <span className="text-muted-foreground">
            {t("stepProgress", {
              current: stepIndex + 1,
              total: steps.length,
            })}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step body */}
      {step === "service" && (
        <div className="grid gap-3">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => chooseService(s.id)}
              className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:border-primary"
            >
              <span>
                <span className="block font-medium">{s.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {s.durationMinutes} {t("minUnit")}
                  {s.price ? ` · ${money(s.price)}` : ""}
                </span>
              </span>
              <span aria-hidden className="text-primary">
                →
              </span>
            </button>
          ))}
        </div>
      )}

      {step === "when" && (
        <div className="space-y-4">
          {/* Clinician picker — only worth showing when there is a choice. */}
          {providers.length > 1 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t("providerLabel")}
              </legend>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={providerId === null}
                  onClick={() => chooseProvider(null)}
                  className={`min-h-11 rounded-full border px-4 text-sm ${
                    providerId === null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  }`}
                >
                  {t("anyProvider")}
                </button>
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={providerId === p.id}
                    onClick={() => chooseProvider(p.id)}
                    className={`min-h-11 rounded-full border px-4 text-sm ${
                      providerId === p.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {loadingSlots && (
            <p className="text-sm text-muted-foreground">{t("findingTimes")}</p>
          )}
          {!loadingSlots && days && days.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noTimes")}</p>
          )}
          {!loadingSlots && days && days.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {days.map((d) => (
                  <button
                    key={d.date}
                    onClick={() => {
                      setSelectedDate(d.date);
                      setSlot(null);
                    }}
                    className={`min-h-11 rounded-full border px-4 text-sm ${
                      d.date === selectedDate
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {days
                  .find((d) => d.date === selectedDate)
                  ?.slots.map((s) => (
                    <button
                      key={s.startIso}
                      onClick={() => setSlot(s)}
                      className={`min-h-11 rounded-lg border text-sm ${
                        slot?.startIso === s.startIso
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {s.time}
                    </button>
                  ))}
              </div>
            </>
          )}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={back}>
              {t("back")}
            </Button>
            <Button size="lg" disabled={!slot} onClick={next}>
              {t("continue")}
            </Button>
          </div>
        </div>
      )}

      {step === "details" && (
        <div className="space-y-3">
          <FormRenderer
            schema={contactForm}
            defaultValues={contact ?? undefined}
            submitLabel={t("continue")}
            onSubmit={(values) => {
              setContact(values);
              next();
            }}
          />
          <Button variant="ghost" onClick={back}>
            {t("back")}
          </Button>
        </div>
      )}

      {step === "intake" && (
        <div className="space-y-3">
          <FormRenderer
            schema={intakeForm}
            defaultValues={intake ?? undefined}
            submitLabel={t("continue")}
            onSubmit={(values) => {
              setIntake(values);
              next();
            }}
          />
          <Button variant="ghost" onClick={back}>
            {t("back")}
          </Button>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label={t("service")} value={service?.name ?? ""} />
              <Row
                label={t("when")}
                value={slot ? formatWhen(slot.startIso) : ""}
              />
              {providers.length > 1 && (
                <Row
                  label={t("providerLabel")}
                  value={
                    providerId
                      ? (providers.find((p) => p.id === providerId)?.name ?? "")
                      : t("anyProvider")
                  }
                />
              )}
              <Row label={t("name")} value={String(contact?.fullName ?? "")} />
              <Row label={t("phone")} value={String(contact?.phone ?? "")} />
            </CardContent>
          </Card>

          {result && !result.ok && (
            <p className="text-sm font-medium text-destructive">
              {bookingErrorMessage(result)}
            </p>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={back} disabled={submitting}>
              {t("back")}
            </Button>
            <Button size="lg" onClick={confirm} disabled={submitting}>
              {submitting ? t("booking") : t("confirm")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
