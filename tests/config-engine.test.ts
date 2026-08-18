import { describe, it, expect } from "vitest";
import {
  parseClinicConfig,
  safeParseClinicConfig,
  isModuleEnabled,
  scheduleBreakSchema,
  scheduleExceptionSchema,
} from "@config-engine";
import { smileDental } from "@/config/clinics/smile-dental";
import { littleStarsPediatric } from "@/config/clinics/little-stars-pediatric";

describe("parseClinicConfig", () => {
  it("validates and normalizes the dental sample (billing off)", () => {
    const c = parseClinicConfig(smileDental);
    expect(c.slug).toBe("smile-dental");
    expect(c.modules.billing).toBe(false);
    expect(isModuleEnabled(c, "appointments")).toBe(true);
    // schema defaults are applied
    expect(c.bookingRules.cancellationWindowHours).toBeGreaterThanOrEqual(0);
  });

  it("validates the pediatric sample (telehealth on, Myanmar default)", () => {
    const c = parseClinicConfig(littleStarsPediatric);
    expect(c.modules.telehealth).toBe(true);
    expect(c.locale.defaultLang).toBe("my");
    expect(c.services.some((s) => s.telehealth)).toBe(true);
  });

  it("rejects invalid configs", () => {
    expect(() => parseClinicConfig({})).toThrow();
    expect(() => parseClinicConfig({ slug: "x" })).toThrow();
  });

  it("rejects a phoneCountryCode written with a leading +", () => {
    const bad = {
      ...smileDental,
      locale: { ...smileDental.locale, phoneCountryCode: "+95" },
    };
    expect(safeParseClinicConfig(bad).success).toBe(false);
  });
});

/**
 * These are the config mistakes that would otherwise fail silently — a typo'd
 * holiday date simply never matches, so the clinic keeps taking bookings on a
 * day it is closed. Fail at load instead.
 */
describe("scheduleExceptionSchema", () => {
  it("accepts a single closed day and defaults `closed` to true", () => {
    const r = scheduleExceptionSchema.parse({ from: "2026-04-13" });
    expect(r.closed).toBe(true);
  });

  it("accepts an inclusive range", () => {
    expect(
      scheduleExceptionSchema.safeParse({
        from: "2026-04-13",
        to: "2026-04-16",
      }).success
    ).toBe(true);
  });

  it("rejects a date that is not a real calendar day", () => {
    expect(scheduleExceptionSchema.safeParse({ from: "2026-02-30" }).success).toBe(
      false
    );
    expect(scheduleExceptionSchema.safeParse({ from: "13-04-2026" }).success).toBe(
      false
    );
  });

  it("rejects a range that ends before it starts", () => {
    expect(
      scheduleExceptionSchema.safeParse({
        from: "2026-04-16",
        to: "2026-04-13",
      }).success
    ).toBe(false);
  });

  it("rejects hours declared on a closed day", () => {
    expect(
      scheduleExceptionSchema.safeParse({
        from: "2026-04-13",
        closed: true,
        openTime: "09:00",
        closeTime: "12:00",
      }).success
    ).toBe(false);
  });

  it("requires both times for special hours", () => {
    expect(
      scheduleExceptionSchema.safeParse({
        from: "2026-04-13",
        closed: false,
        openTime: "09:00",
      }).success
    ).toBe(false);
  });

  it("rejects inverted special hours", () => {
    expect(
      scheduleExceptionSchema.safeParse({
        from: "2026-04-13",
        closed: false,
        openTime: "13:00",
        closeTime: "09:00",
      }).success
    ).toBe(false);
  });
});

describe("scheduleBreakSchema", () => {
  it("accepts a lunch break", () => {
    expect(
      scheduleBreakSchema.safeParse({
        startTime: "12:00",
        endTime: "13:00",
        label: "Lunch",
      }).success
    ).toBe(true);
  });

  it("rejects an inverted or empty break", () => {
    expect(
      scheduleBreakSchema.safeParse({ startTime: "13:00", endTime: "12:00" })
        .success
    ).toBe(false);
    expect(
      scheduleBreakSchema.safeParse({ startTime: "12:00", endTime: "12:00" })
        .success
    ).toBe(false);
  });

  it("rejects an out-of-range weekday", () => {
    expect(
      scheduleBreakSchema.safeParse({
        startTime: "12:00",
        endTime: "13:00",
        days: [7],
      }).success
    ).toBe(false);
  });
});
