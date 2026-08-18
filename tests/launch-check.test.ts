import { describe, it, expect } from "vitest";
import {
  parseClinicConfig,
  runLaunchChecks,
  hasBlockingFindings,
  type CheckFinding,
  type ClinicConfigInput,
} from "@config-engine";
import { smileDental } from "@/config/clinics/smile-dental";

/**
 * The launch check is the machine-readable half of
 * docs/09-new-clinic-checklist.md. Its value depends entirely on `error`
 * meaning "this breaks something real for a patient" — so these tests pin both
 * that a problem is caught AND that it is caught at the right severity.
 */

/** A fully-configured environment, so env findings don't drown the config ones. */
const GOOD_ENV: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  DATABASE_URL: "postgresql://u:p@host:6543/postgres",
  RESEND_API_KEY: "re_x",
  EMAIL_FROM: "Clinic <hi@clinic.mm>",
  SMS_PROVIDER: "twilio",
  CRON_SECRET: "s3cret",
};

/** The dental sample with its two known template leftovers cleaned up. */
function healthyConfig(over: Partial<ClinicConfigInput> = {}) {
  return parseClinicConfig({
    ...smileDental,
    contact: { ...smileDental.contact!, email: "hello@smiledental.mm" },
    businessHours: {
      ...smileDental.businessHours!,
      // Far-future so the expired-holiday check stays quiet as time passes.
      exceptions: [{ from: "2099-04-13", to: "2099-04-16", label: "Thingyan" }],
    },
    ...over,
  });
}

function run(over: Partial<ClinicConfigInput> = {}, env = GOOD_ENV) {
  return runLaunchChecks({
    config: healthyConfig(over),
    env,
    icons: [{ path: "public/icon.svg", exists: true }],
    today: "2026-08-18",
  });
}

const messages = (f: CheckFinding[]) => f.map((x) => x.message).join("\n");
const errorsOf = (f: CheckFinding[]) => f.filter((x) => x.level === "error");

describe("runLaunchChecks — a finished clinic", () => {
  it("passes with nothing blocking", () => {
    const findings = run();
    expect(errorsOf(findings)).toEqual([]);
    expect(hasBlockingFindings(findings)).toBe(false);
  });
});

describe("template leftovers", () => {
  it("blocks on an unfilled clinic name", () => {
    const findings = run({
      branding: { ...smileDental.branding, name: "Your Clinic Name" },
    });
    expect(errorsOf(findings).length).toBeGreaterThan(0);
    expect(messages(findings)).toContain("branding.name");
  });

  it("blocks on a leftover .example contact address", () => {
    const findings = run({
      contact: { ...smileDental.contact!, email: "hello@clinic.example" },
    });
    expect(messages(errorsOf(findings))).toContain("contact.email");
  });

  it("catches the template slug and id", () => {
    const findings = run({ slug: "template-clinic", id: "clinic_template" });
    const text = messages(errorsOf(findings));
    expect(text).toContain("slug");
    expect(text).toContain("id");
  });
});

describe("contactability", () => {
  it("blocks when patients have no number to call", () => {
    // Cancelling outside the window tells the patient to phone the clinic.
    const findings = run({ contact: { address: "Somewhere" } });
    expect(messages(errorsOf(findings))).toContain("contact phone");
  });
});

describe("booking rules", () => {
  it("blocks when the lead time exceeds the whole horizon", () => {
    const findings = run({
      bookingRules: { leadTimeHours: 24 * 40, cancellationWindowHours: 24 },
      businessHours: { ...smileDental.businessHours!, bookingHorizonDays: 30 },
    });
    expect(messages(errorsOf(findings))).toContain("leadTimeHours");
  });

  it("warns when nobody could ever cancel online", () => {
    const findings = run({
      bookingRules: { leadTimeHours: 2, cancellationWindowHours: 24 * 40 },
      businessHours: { ...smileDental.businessHours!, bookingHorizonDays: 30 },
    });
    expect(
      findings.some(
        (f) => f.level === "warn" && f.message.includes("cancellationWindowHours")
      )
    ).toBe(true);
  });
});

describe("dated schedule exceptions", () => {
  it("blocks when every holiday has expired", () => {
    // The failure mode this exists for: last year's dates stop matching and the
    // clinic silently starts taking bookings on public holidays.
    const findings = run({
      businessHours: {
        ...smileDental.businessHours!,
        exceptions: [{ from: "2020-04-13", to: "2020-04-16" }],
      },
    });
    expect(messages(errorsOf(findings))).toContain("in the past");
  });

  it("only notes partially expired exceptions", () => {
    const findings = run({
      businessHours: {
        ...smileDental.businessHours!,
        exceptions: [{ from: "2020-01-01" }, { from: "2099-01-01" }],
      },
    });
    expect(errorsOf(findings)).toEqual([]);
    expect(messages(findings)).toContain("expired");
  });

  it("warns when there are no holidays at all", () => {
    const findings = run({
      businessHours: { ...smileDental.businessHours!, exceptions: [] },
    });
    expect(
      findings.some((f) => f.level === "warn" && f.message.includes("public holiday"))
    ).toBe(true);
  });
});

describe("notifications", () => {
  it("blocks when a channel is on but has no gateway", () => {
    const findings = run({}, { ...GOOD_ENV, RESEND_API_KEY: undefined });
    expect(messages(errorsOf(findings))).toContain("RESEND_API_KEY");
  });

  it("blocks when CRON_SECRET is unset, because reminders fail closed", () => {
    const findings = run({}, { ...GOOD_ENV, CRON_SECRET: undefined });
    expect(messages(errorsOf(findings))).toContain("CRON_SECRET");
  });

  it("warns an email-only clinic that it misses patients without an address", () => {
    const findings = run({ notifications: { channels: ["email"] } });
    expect(
      findings.some((f) => f.level === "warn" && f.message.includes("SMS is off"))
    ).toBe(true);
  });

  it("says nothing about gateways when the module is off", () => {
    const findings = run(
      {
        modules: { ...smileDental.modules, notifications: false },
        notifications: { channels: ["email"] },
      },
      { ...GOOD_ENV, RESEND_API_KEY: undefined, CRON_SECRET: undefined }
    );
    expect(messages(findings)).not.toContain("RESEND_API_KEY");
    expect(messages(findings)).not.toContain("CRON_SECRET");
  });
});

describe("environment", () => {
  it("blocks on missing Supabase credentials", () => {
    const findings = run({}, { ...GOOD_ENV, DATABASE_URL: undefined });
    expect(messages(errorsOf(findings))).toContain("DATABASE_URL");
  });

  it("warns when not using the transaction pooler", () => {
    const findings = run(
      {},
      { ...GOOD_ENV, DATABASE_URL: "postgresql://u:p@host:5432/postgres" }
    );
    expect(
      findings.some((f) => f.level === "warn" && f.message.includes("pooler"))
    ).toBe(true);
  });
});

describe("assets", () => {
  it("does not block on a missing icon", () => {
    // Annoying, not patient-breaking — `error` must stay meaningful.
    const findings = runLaunchChecks({
      config: healthyConfig(),
      env: GOOD_ENV,
      icons: [{ path: "app/icon.svg", exists: false }],
      today: "2026-08-18",
    });
    expect(errorsOf(findings)).toEqual([]);
    expect(messages(findings)).toContain("app/icon.svg is missing");
  });

  it("flags an unswapped starter asset", () => {
    const findings = runLaunchChecks({
      config: healthyConfig(),
      env: GOOD_ENV,
      icons: [{ path: "app/favicon.ico", exists: true, isPlaceholder: true }],
      today: "2026-08-18",
    });
    expect(messages(findings)).toContain("starter asset");
  });

  it("reports when icons could not be inspected at all", () => {
    // Better than silently passing a check that never ran.
    const findings = runLaunchChecks({
      config: healthyConfig(),
      env: GOOD_ENV,
      today: "2026-08-18",
    });
    expect(messages(findings)).toContain("not checked");
  });
});

describe("finding order", () => {
  it("puts blocking problems first", () => {
    const findings = run({ contact: { address: "x" } }, {});
    const levels = findings.map((f) => f.level);
    expect(levels).toEqual([...levels].sort((a, b) =>
      ({ error: 0, warn: 1, info: 2 })[a] - ({ error: 0, warn: 1, info: 2 })[b]
    ));
  });
});

describe("--config-only support", () => {
  it("tags environment findings so they can be filtered out", () => {
    const findings = run({}, {});
    const envFindings = findings.filter((f) => f.dependsOnEnv);
    // Every Supabase variable is missing, so these must be tagged.
    expect(envFindings.length).toBeGreaterThan(0);
    expect(messages(envFindings)).toContain("DATABASE_URL");

    // …and dropping them must leave the config half intact and untagged.
    const configOnly = findings.filter((f) => !f.dependsOnEnv);
    expect(configOnly.every((f) => !f.dependsOnEnv)).toBe(true);
    expect(messages(configOnly)).not.toContain("DATABASE_URL");
  });

  it("does not tag config findings as environment ones", () => {
    const findings = run({ contact: { address: "x" } }, GOOD_ENV);
    const phone = findings.find((f) => f.message.includes("contact phone"));
    expect(phone?.dependsOnEnv).toBeFalsy();
  });
});
