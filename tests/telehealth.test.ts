import { describe, it, expect } from "vitest";
import { meetingUrl, isJoinable } from "@modules/telehealth";

describe("meetingUrl", () => {
  it("builds a Jitsi room from clinic slug + appointment id", () => {
    expect(
      meetingUrl({ appointmentId: "abc-123", clinicSlug: "smile-dental" })
    ).toBe("https://meet.jit.si/smile-dental-abc-123");
  });

  it("strips characters that aren't safe for a room name", () => {
    expect(
      meetingUrl({ appointmentId: "a/b c!", clinicSlug: "clinic" })
    ).toBe("https://meet.jit.si/clinic-abc");
  });
});

describe("isJoinable", () => {
  const now = new Date("2026-07-01T10:00:00.000Z").getTime();
  const at = (mins: number) =>
    new Date(now + mins * 60_000).toISOString();

  it("is joinable from 10 minutes before start", () => {
    expect(isJoinable(at(5), 20, now)).toBe(true); // starts in 5 min
    expect(isJoinable(at(10), 20, now)).toBe(true); // exactly at the lead edge
  });

  it("is not joinable too early", () => {
    expect(isJoinable(at(20), 20, now)).toBe(false); // starts in 20 min
  });

  it("is not joinable after it has ended", () => {
    // started 30 min ago, 20 min long → ended 10 min ago
    expect(isJoinable(at(-30), 20, now)).toBe(false);
  });

  it("is joinable during the appointment", () => {
    expect(isJoinable(at(-5), 20, now)).toBe(true);
  });
});
