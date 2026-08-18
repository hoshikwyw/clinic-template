import { describe, it, expect } from "vitest";
import {
  generateDaySlots,
  zonedWallTimeToUtc,
  wallTimeExists,
  findScheduleException,
  type GenerateSlotsOptions,
} from "@modules/scheduling";

const baseHours = {
  openDays: [0, 1, 2, 3, 4, 5, 6],
  openTime: "09:00",
  closeTime: "12:00",
  slotMinutes: 60,
  bookingHorizonDays: 1,
  breaks: [],
  exceptions: [],
};

function opts(over: Partial<GenerateSlotsOptions> = {}): GenerateSlotsOptions {
  return {
    businessHours: baseHours,
    serviceDurationMinutes: 60,
    timeZone: "UTC",
    leadTimeHours: 0,
    // midnight UTC so every same-day slot is in the future
    now: new Date("2026-07-01T00:00:00.000Z"),
    ...over,
  };
}

describe("zonedWallTimeToUtc", () => {
  it("converts a UTC wall time to the same instant", () => {
    expect(zonedWallTimeToUtc(2026, 7, 1, 12, 0, "UTC").toISOString()).toBe(
      "2026-07-01T12:00:00.000Z"
    );
  });

  it("converts Asia/Yangon (UTC+6:30) wall time to UTC", () => {
    // 09:00 in Yangon is 02:30 UTC
    expect(
      zonedWallTimeToUtc(2026, 7, 1, 9, 0, "Asia/Yangon").toISOString()
    ).toBe("2026-07-01T02:30:00.000Z");
  });

  // DST is where a single-pass offset lookup silently produces times an hour
  // out. Myanmar has no DST, so these guard the template for everyone else.
  describe("across DST transitions (America/New_York)", () => {
    it("resolves wall times on both sides of spring-forward", () => {
      // 2026-03-08 02:00 EST → 03:00 EDT
      expect(
        zonedWallTimeToUtc(2026, 3, 8, 1, 0, "America/New_York").toISOString()
      ).toBe("2026-03-08T06:00:00.000Z"); // UTC-5
      expect(
        zonedWallTimeToUtc(2026, 3, 8, 3, 0, "America/New_York").toISOString()
      ).toBe("2026-03-08T07:00:00.000Z"); // UTC-4
    });

    it("takes the first occurrence of an ambiguous fall-back time", () => {
      // 2026-11-01 01:30 happens twice; we take the pre-transition (EDT) one.
      expect(
        zonedWallTimeToUtc(2026, 11, 1, 1, 30, "America/New_York").toISOString()
      ).toBe("2026-11-01T05:30:00.000Z");
    });
  });
});

describe("wallTimeExists", () => {
  it("rejects a wall time skipped by spring-forward", () => {
    // 02:30 never happens on 2026-03-08 in New York.
    expect(wallTimeExists(2026, 3, 8, 150, "America/New_York")).toBe(false);
  });

  it("accepts ordinary wall times", () => {
    expect(wallTimeExists(2026, 3, 8, 180, "America/New_York")).toBe(true);
    expect(wallTimeExists(2026, 7, 1, 540, "Asia/Yangon")).toBe(true);
  });
});

describe("generateDaySlots", () => {
  it("generates slots across the open window respecting service duration", () => {
    const days = generateDaySlots(opts());
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2026-07-01");
    // 09:00, 10:00, 11:00 (11:00 + 60min = 12:00 close, fits)
    expect(days[0].slots.map((s) => s.time)).toEqual([
      "09:00",
      "10:00",
      "11:00",
    ]);
    expect(days[0].slots[0].startIso).toBe("2026-07-01T09:00:00.000Z");
  });

  it("drops the last slot when the service does not fit before close", () => {
    const days = generateDaySlots(opts({ serviceDurationMinutes: 90 }));
    // 11:00 + 90min = 12:30 > 12:00, so only 09:00 and 10:00
    expect(days[0].slots.map((s) => s.time)).toEqual(["09:00", "10:00"]);
  });

  it("removes slots inside the lead time", () => {
    const days = generateDaySlots(opts({ leadTimeHours: 10 }));
    // minStart = 10:00 UTC → 09:00 removed
    expect(days[0].slots.map((s) => s.time)).toEqual(["10:00", "11:00"]);
  });

  it("returns no days when the clinic is closed every day", () => {
    expect(
      generateDaySlots(opts({ businessHours: { ...baseHours, openDays: [] } }))
    ).toEqual([]);
  });

  it("respects the booking horizon", () => {
    const days = generateDaySlots(
      opts({ businessHours: { ...baseHours, bookingHorizonDays: 3 } })
    );
    expect(days.length).toBe(3);
  });

  describe("breaks", () => {
    it("removes slots that overlap a break, keeping adjacent ones", () => {
      const days = generateDaySlots(
        opts({
          businessHours: {
            ...baseHours,
            breaks: [{ startTime: "10:00", endTime: "11:00", label: "Lunch" }],
          },
        })
      );
      // 09:00–10:00 and 11:00–12:00 touch the break but do not overlap it.
      expect(days[0].slots.map((s) => s.time)).toEqual(["09:00", "11:00"]);
    });

    it("removes any slot that straddles a break", () => {
      const days = generateDaySlots(
        opts({
          businessHours: {
            ...baseHours,
            breaks: [{ startTime: "10:30", endTime: "10:45" }],
          },
        })
      );
      // 10:00–11:00 straddles the 15-minute break, so it goes.
      expect(days[0].slots.map((s) => s.time)).toEqual(["09:00", "11:00"]);
    });

    it("ignores a break scoped to other weekdays", () => {
      // 2026-07-01 is a Wednesday (3).
      const days = generateDaySlots(
        opts({
          businessHours: {
            ...baseHours,
            breaks: [{ startTime: "10:00", endTime: "11:00", days: [1] }],
          },
        })
      );
      expect(days[0].slots).toHaveLength(3);
    });
  });

  describe("exceptions", () => {
    it("closes a single dated day", () => {
      const days = generateDaySlots(
        opts({
          businessHours: {
            ...baseHours,
            bookingHorizonDays: 2,
            exceptions: [{ from: "2026-07-01", closed: true, label: "Holiday" }],
          },
        })
      );
      expect(days.map((d) => d.date)).toEqual(["2026-07-02"]);
    });

    it("closes an inclusive date range", () => {
      const days = generateDaySlots(
        opts({
          businessHours: {
            ...baseHours,
            bookingHorizonDays: 5,
            exceptions: [
              { from: "2026-07-01", to: "2026-07-03", closed: true },
            ],
          },
        })
      );
      expect(days.map((d) => d.date)).toEqual(["2026-07-04", "2026-07-05"]);
    });

    it("applies replacement hours", () => {
      const days = generateDaySlots(
        opts({
          businessHours: {
            ...baseHours,
            exceptions: [
              {
                from: "2026-07-01",
                closed: false,
                openTime: "09:00",
                closeTime: "11:00",
              },
            ],
          },
        })
      );
      expect(days[0].slots.map((s) => s.time)).toEqual(["09:00", "10:00"]);
    });

    it("can open a day the weekly pattern keeps closed", () => {
      const days = generateDaySlots(
        opts({
          businessHours: {
            ...baseHours,
            openDays: [], // never normally open
            exceptions: [
              {
                from: "2026-07-01",
                closed: false,
                openTime: "09:00",
                closeTime: "11:00",
              },
            ],
          },
        })
      );
      expect(days.map((d) => d.date)).toEqual(["2026-07-01"]);
    });

    it("lets a later exception carve a day out of an earlier range", () => {
      const days = generateDaySlots(
        opts({
          businessHours: {
            ...baseHours,
            bookingHorizonDays: 3,
            exceptions: [
              { from: "2026-07-01", to: "2026-07-03", closed: true },
              {
                from: "2026-07-02",
                closed: false,
                openTime: "09:00",
                closeTime: "10:00",
              },
            ],
          },
        })
      );
      expect(days.map((d) => d.date)).toEqual(["2026-07-02"]);
    });

    it("still applies breaks inside replacement hours", () => {
      const days = generateDaySlots(
        opts({
          businessHours: {
            ...baseHours,
            breaks: [{ startTime: "10:00", endTime: "11:00" }],
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
      expect(days[0].slots.map((s) => s.time)).toEqual(["09:00", "11:00"]);
    });
  });

  describe("DST-zone horizons", () => {
    const nyHours = {
      ...baseHours,
      openTime: "01:00",
      closeTime: "05:00",
      bookingHorizonDays: 3,
    };

    it("walks consecutive local dates across a spring-forward", () => {
      const days = generateDaySlots(
        opts({
          // 2026-03-05 19:00 in New York, so the horizon's first local date
          // (03-05) is already past and drops out on its own.
          businessHours: { ...nyHours, bookingHorizonDays: 4 },
          timeZone: "America/New_York",
          now: new Date("2026-03-06T00:00:00.000Z"),
        })
      );
      // Adding 24h at a time would skip or repeat 2026-03-08.
      expect(days.map((d) => d.date)).toEqual([
        "2026-03-06",
        "2026-03-07",
        "2026-03-08",
      ]);
    });

    it("omits the slot at a wall time the transition skipped", () => {
      const days = generateDaySlots(
        opts({
          businessHours: { ...nyHours, bookingHorizonDays: 2 },
          timeZone: "America/New_York",
          now: new Date("2026-03-08T00:00:00.000Z"),
        })
      );
      const march8 = days.find((d) => d.date === "2026-03-08");
      // 02:00 EST does not exist on this date.
      expect(march8?.slots.map((s) => s.time)).toEqual([
        "01:00",
        "03:00",
        "04:00",
      ]);
      // …and the surviving slots are a real hour apart in absolute time.
      expect(march8?.slots[0].startIso).toBe("2026-03-08T06:00:00.000Z");
      expect(march8?.slots[1].startIso).toBe("2026-03-08T07:00:00.000Z");
    });
  });
});

describe("findScheduleException", () => {
  const exceptions = [
    { from: "2026-04-13", to: "2026-04-16", closed: true, label: "Thingyan" },
    { from: "2026-05-01", closed: true, label: "Labour Day" },
  ];

  it("matches inside a range, at both ends", () => {
    expect(findScheduleException(exceptions, "2026-04-13")?.label).toBe(
      "Thingyan"
    );
    expect(findScheduleException(exceptions, "2026-04-16")?.label).toBe(
      "Thingyan"
    );
    expect(findScheduleException(exceptions, "2026-04-15")?.label).toBe(
      "Thingyan"
    );
  });

  it("matches a single-day exception", () => {
    expect(findScheduleException(exceptions, "2026-05-01")?.label).toBe(
      "Labour Day"
    );
  });

  it("returns undefined for unaffected dates", () => {
    expect(findScheduleException(exceptions, "2026-04-17")).toBeUndefined();
    expect(findScheduleException([], "2026-04-13")).toBeUndefined();
  });
});
