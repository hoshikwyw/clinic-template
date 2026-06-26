import { describe, it, expect } from "vitest";
import { parseClinicConfig, isModuleEnabled } from "@config-engine";
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
});
