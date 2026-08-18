import { describe, it, expect } from "vitest";
import {
  parseClinicConfig,
  safeParseClinicConfig,
  getBookableProviders,
  getProvidersForService,
  findProvider,
  hasMultipleProviders,
  DEFAULT_PROVIDER_ID,
  type ClinicConfigInput,
} from "@config-engine";
import { generateDaySlots, type GenerateSlotsOptions } from "@modules/scheduling";
import { smileDental } from "@/config/clinics/smile-dental";

/**
 * Providers are what lift the app off its one-appointment-at-a-time floor, so
 * the two things that must never regress are: a clinic with no providers keeps
 * behaving exactly as it did before, and provider hours are INTERSECTED with
 * the clinic's rather than overriding them.
 */

/** Smallest config that parses, as a base for focused cases. */
function baseConfig(over: Partial<ClinicConfigInput> = {}): ClinicConfigInput {
  return {
    id: "c",
    slug: "c",
    specialty: "dental",
    branding: { name: "Test Clinic", primaryColor: "#000" },
    locale: {
      languages: ["en"],
      defaultLang: "en",
      timezone: "UTC",
      currency: "USD",
    },
    modules: {
      appointments: true,
      patients: true,
      scheduling: true,
      notifications: false,
      billing: false,
      staff: false,
      telehealth: false,
    },
    services: [{ id: "checkup", name: "Check-up", durationMinutes: 30 }],
    bookingRules: { leadTimeHours: 0, cancellationWindowHours: 24 },
    ...over,
  };
}

describe("getBookableProviders", () => {
  it("synthesises a single provider when none are configured", () => {
    const c = parseClinicConfig(baseConfig());
    const providers = getBookableProviders(c);
    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe(DEFAULT_PROVIDER_ID);
    // Named after the clinic, so a single-provider booking still reads sensibly.
    expect(providers[0].name).toBe("Test Clinic");
    expect(hasMultipleProviders(c)).toBe(false);
  });

  it("excludes providers marked unbookable", () => {
    const c = parseClinicConfig(
      baseConfig({
        providers: [
          { id: "a", name: "Dr. A", role: "Dentist" },
          { id: "b", name: "Dr. B", role: "Dentist", bookable: false },
        ],
      })
    );
    expect(getBookableProviders(c).map((p) => p.id)).toEqual(["a"]);
  });

  it("falls back to the implicit provider when all are unbookable", () => {
    const c = parseClinicConfig(
      baseConfig({
        providers: [
          { id: "a", name: "Dr. A", role: "Dentist", bookable: false },
        ],
      })
    );
    // Better than offering nothing at all: the clinic can still take bookings.
    expect(getBookableProviders(c)[0].id).toBe(DEFAULT_PROVIDER_ID);
  });

  it("finds a provider by id, including the implicit one", () => {
    const c = parseClinicConfig(baseConfig());
    expect(findProvider(c, DEFAULT_PROVIDER_ID)?.name).toBe("Test Clinic");
    expect(findProvider(c, "nobody")).toBeUndefined();
  });
});

describe("getProvidersForService", () => {
  const config = parseClinicConfig(
    baseConfig({
      services: [
        { id: "checkup", name: "Check-up", durationMinutes: 30 },
        { id: "surgery", name: "Surgery", durationMinutes: 60 },
      ],
      providers: [
        { id: "generalist", name: "Dr. G", role: "Dentist" }, // all services
        {
          id: "surgeon",
          name: "Dr. S",
          role: "Surgeon",
          serviceIds: ["surgery"],
        },
      ],
    })
  );

  it("includes providers with no serviceIds in everything", () => {
    expect(getProvidersForService(config, "checkup").map((p) => p.id)).toEqual([
      "generalist",
    ]);
  });

  it("returns providers in config order, which is assignment order", () => {
    expect(getProvidersForService(config, "surgery").map((p) => p.id)).toEqual([
      "generalist",
      "surgeon",
    ]);
  });
});

describe("provider config validation", () => {
  it("rejects duplicate provider ids", () => {
    const r = safeParseClinicConfig(
      baseConfig({
        providers: [
          { id: "a", name: "Dr. A", role: "Dentist" },
          { id: "a", name: "Dr. B", role: "Dentist" },
        ],
      })
    );
    expect(r.success).toBe(false);
  });

  it("rejects a provider listing an unknown service id", () => {
    const r = safeParseClinicConfig(
      baseConfig({
        providers: [
          { id: "a", name: "Dr. A", role: "Dentist", serviceIds: ["nope"] },
        ],
      })
    );
    expect(r.success).toBe(false);
  });

  it("rejects a service no bookable provider offers", () => {
    // Otherwise the service sits on the booking page with zero availability
    // forever and it reads as a bug.
    const r = safeParseClinicConfig(
      baseConfig({
        services: [
          { id: "checkup", name: "Check-up", durationMinutes: 30 },
          { id: "orphan", name: "Orphan", durationMinutes: 30 },
        ],
        providers: [
          { id: "a", name: "Dr. A", role: "Dentist", serviceIds: ["checkup"] },
        ],
      })
    );
    expect(r.success).toBe(false);
  });

  it("rejects provider hours that close before they open", () => {
    const r = safeParseClinicConfig(
      baseConfig({
        providers: [
          {
            id: "a",
            name: "Dr. A",
            role: "Dentist",
            hours: { openTime: "17:00", closeTime: "09:00" },
          },
        ],
      })
    );
    expect(r.success).toBe(false);
  });
});

describe("doctors derived from providers", () => {
  it("populates the public team list from providers", () => {
    const c = parseClinicConfig(
      baseConfig({
        providers: [
          { id: "a", name: "Dr. A", role: "Dentist", bio: "Bio A" },
          { id: "b", name: "Dr. B", role: "Hygienist", showOnWebsite: false },
        ],
      })
    );
    expect(c.doctors).toEqual([{ name: "Dr. A", role: "Dentist", bio: "Bio A" }]);
  });

  it("keeps an explicitly authored doctors list", () => {
    const c = parseClinicConfig(
      baseConfig({
        doctors: [{ name: "Dr. Retired", role: "Founder" }],
        providers: [{ id: "a", name: "Dr. A", role: "Dentist" }],
      })
    );
    expect(c.doctors.map((d) => d.name)).toEqual(["Dr. Retired"]);
  });

  it("keeps the dental sample's team intact after the move to providers", () => {
    const c = parseClinicConfig(smileDental);
    expect(c.doctors.map((d) => d.name)).toEqual([
      "Dr. Aung Min",
      "Dr. Su Latt",
      "Dr. Kyaw Zin",
    ]);
  });
});

describe("generateDaySlots with providerHours", () => {
  const clinicHours = {
    openDays: [1, 2, 3, 4, 5],
    openTime: "09:00",
    closeTime: "17:00",
    slotMinutes: 60,
    bookingHorizonDays: 1,
    breaks: [],
    exceptions: [],
  };

  // 2026-07-01 is a Wednesday.
  function opts(over: Partial<GenerateSlotsOptions> = {}): GenerateSlotsOptions {
    return {
      businessHours: clinicHours,
      serviceDurationMinutes: 60,
      timeZone: "UTC",
      leadTimeHours: 0,
      now: new Date("2026-07-01T00:00:00.000Z"),
      ...over,
    };
  }

  it("falls back to clinic hours when the provider declares none", () => {
    const withProvider = generateDaySlots(
      opts({ providerHours: { breaks: [], exceptions: [] } })
    );
    expect(withProvider[0].slots.map((s) => s.time)).toEqual(
      generateDaySlots(opts())[0].slots.map((s) => s.time)
    );
  });

  it("narrows to the provider's own window", () => {
    const days = generateDaySlots(
      opts({
        providerHours: {
          openTime: "10:00",
          closeTime: "12:00",
          breaks: [],
          exceptions: [],
        },
      })
    );
    expect(days[0].slots.map((s) => s.time)).toEqual(["10:00", "11:00"]);
  });

  it("clips a provider window that reaches past the clinic's", () => {
    // Intersection, not override — a clinician cannot work while the building
    // is shut.
    const days = generateDaySlots(
      opts({
        providerHours: {
          openTime: "08:00",
          closeTime: "20:00",
          breaks: [],
          exceptions: [],
        },
      })
    );
    const times = days[0].slots.map((s) => s.time);
    expect(times[0]).toBe("09:00");
    expect(times[times.length - 1]).toBe("16:00");
  });

  it("drops days the provider does not work", () => {
    const days = generateDaySlots(
      opts({
        providerHours: { openDays: [1], breaks: [], exceptions: [] },
      })
    );
    expect(days).toEqual([]);
  });

  it("applies the provider's own break on top of the clinic's", () => {
    const days = generateDaySlots(
      opts({
        businessHours: {
          ...clinicHours,
          openTime: "09:00",
          closeTime: "13:00",
          breaks: [{ startTime: "10:00", endTime: "11:00", label: "Clinic" }],
        },
        providerHours: {
          breaks: [{ startTime: "11:00", endTime: "12:00", label: "Personal" }],
          exceptions: [],
        },
      })
    );
    // 09:00 survives; 10:00 hits the clinic break; 11:00 hits the provider's.
    expect(days[0].slots.map((s) => s.time)).toEqual(["09:00", "12:00"]);
  });

  it("honours provider leave", () => {
    const days = generateDaySlots(
      opts({
        providerHours: {
          breaks: [],
          exceptions: [{ from: "2026-07-01", closed: true, label: "Leave" }],
        },
      })
    );
    expect(days).toEqual([]);
  });

  it("never lets a provider open a day the clinic has closed", () => {
    const days = generateDaySlots(
      opts({
        businessHours: {
          ...clinicHours,
          exceptions: [{ from: "2026-07-01", closed: true, label: "Holiday" }],
        },
        providerHours: {
          breaks: [],
          exceptions: [
            {
              from: "2026-07-01",
              closed: false,
              openTime: "09:00",
              closeTime: "12:00",
            },
          ],
        },
      })
    );
    expect(days).toEqual([]);
  });
});
