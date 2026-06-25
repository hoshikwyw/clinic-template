"use client";

import * as React from "react";
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
  createAppointment,
  type BookingResult,
} from "@modules/appointments/server/booking";
import type { DaySlots, Slot } from "@modules/scheduling";

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
}

type StepKey = "service" | "when" | "details" | "intake" | "review";

export function BookingWizard({
  services,
  contactForm,
  intakeForm,
  timeZone,
  currency,
}: BookingWizardProps) {
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
  const [days, setDays] = React.useState<DaySlots[] | null>(null);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [slot, setSlot] = React.useState<Slot | null>(null);
  const [contact, setContact] = React.useState<Record<string, unknown> | null>(
    null
  );
  const [intake, setIntake] = React.useState<Record<string, unknown> | null>(
    null
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<BookingResult | null>(null);

  const step = steps[stepIndex];
  const service = services.find((s) => s.id === serviceId) ?? null;

  function next() {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function back() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function money(n?: number) {
    return n ? `${n.toLocaleString()} ${currency}` : "";
  }

  function formatWhen(iso: string) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  }

  async function chooseService(id: string) {
    setServiceId(id);
    setSlot(null);
    setSelectedDate(null);
    setDays(null);
    setLoadingSlots(true);
    setStepIndex(1);
    try {
      const d = await getAvailableSlots(id);
      setDays(d);
      setSelectedDate(d[0]?.date ?? null);
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
            Appointment requested
          </h2>
          <p className="text-muted-foreground">
            {result.serviceName} ·{" "}
            {result.startIso ? formatWhen(result.startIso) : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            We&apos;ll contact you to confirm. Please keep your phone reachable.
          </p>
          <Button onClick={reset} variant="outline" size="lg" className="mt-2">
            Book another
          </Button>
        </CardContent>
      </Card>
    );
  }

  const stepTitles: Record<StepKey, string> = {
    service: "Choose a service",
    when: "Pick a time",
    details: "Your details",
    intake: "A few questions",
    review: "Review & confirm",
  };

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{stepTitles[step]}</span>
          <span className="text-muted-foreground">
            Step {stepIndex + 1} of {steps.length}
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
                  {s.durationMinutes} min{s.price ? ` · ${money(s.price)}` : ""}
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
          {loadingSlots && (
            <p className="text-sm text-muted-foreground">Finding times…</p>
          )}
          {!loadingSlots && days && days.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No available times in the booking window.
            </p>
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
              Back
            </Button>
            <Button size="lg" disabled={!slot} onClick={next}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "details" && (
        <div className="space-y-3">
          <FormRenderer
            schema={contactForm}
            defaultValues={contact ?? undefined}
            submitLabel="Continue"
            onSubmit={(values) => {
              setContact(values);
              next();
            }}
          />
          <Button variant="ghost" onClick={back}>
            Back
          </Button>
        </div>
      )}

      {step === "intake" && (
        <div className="space-y-3">
          <FormRenderer
            schema={intakeForm}
            defaultValues={intake ?? undefined}
            submitLabel="Continue"
            onSubmit={(values) => {
              setIntake(values);
              next();
            }}
          />
          <Button variant="ghost" onClick={back}>
            Back
          </Button>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Booking summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Service" value={service?.name ?? ""} />
              <Row
                label="When"
                value={slot ? formatWhen(slot.startIso) : ""}
              />
              <Row label="Name" value={String(contact?.fullName ?? "")} />
              <Row label="Phone" value={String(contact?.phone ?? "")} />
            </CardContent>
          </Card>

          {result && !result.ok && (
            <p className="text-sm font-medium text-destructive">
              {result.error}
            </p>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={back} disabled={submitting}>
              Back
            </Button>
            <Button size="lg" onClick={confirm} disabled={submitting}>
              {submitting ? "Booking…" : "Confirm booking"}
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
