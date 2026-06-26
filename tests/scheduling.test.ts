import { describe, it, expect } from "vitest";
import {
  generateDaySlots,
  zonedWallTimeToUtc,
  type GenerateSlotsOptions,
} from "@modules/scheduling";

const baseHours = {
  openDays: [0, 1, 2, 3, 4, 5, 6],
  openTime: "09:00",
  closeTime: "12:00",
  slotMinutes: 60,
  bookingHorizonDays: 1,
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
});
