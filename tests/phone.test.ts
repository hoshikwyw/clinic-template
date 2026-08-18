import { describe, it, expect } from "vitest";
import { normalizePhone, samePhone } from "@/lib/phone";

/**
 * Phone normalisation underpins two things that must not be sloppy: guest
 * booking dedupe (wrong match = one patient reading another's record in the
 * staff directory) and the per-phone booking rate limit (wrong split = the
 * limit is bypassed by adding a space).
 */
describe("normalizePhone", () => {
  const MM = "95"; // Myanmar

  it("strips formatting", () => {
    expect(normalizePhone("09 771 234 567", MM)).toBe("959771234567");
    expect(normalizePhone("(09) 771-234-567", MM)).toBe("959771234567");
  });

  it("collapses national, international, and 00-prefixed forms", () => {
    const forms = [
      "09771234567", // national, trunk 0
      "9771234567", // bare national
      "+959771234567", // international
      "959771234567", // international, no +
      "00959771234567", // international, 00 prefix
      " +95 9 771 234 567 ",
    ];
    const keys = forms.map((f) => normalizePhone(f, MM));
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe("959771234567");
  });

  it("keeps genuinely different numbers apart", () => {
    expect(normalizePhone("09771234567", MM)).not.toBe(
      normalizePhone("09771234568", MM)
    );
  });

  it("only strips formatting when no dialling code is configured", () => {
    expect(normalizePhone("09 771 234 567")).toBe("09771234567");
    // Without the code we cannot know the trunk 0 is not significant, so the
    // two forms stay distinct — documented as the weaker dedupe.
    expect(normalizePhone("09771234567")).not.toBe(
      normalizePhone("+959771234567")
    );
  });

  it("returns empty string when there are no digits", () => {
    expect(normalizePhone("", MM)).toBe("");
    expect(normalizePhone("not a phone", MM)).toBe("");
  });

  it("does not treat a non-matching country code as a trunk prefix", () => {
    // A UK number typed into a Myanmar clinic keeps its own code rather than
    // being mangled into a Myanmar one.
    expect(normalizePhone("+447700900123", MM)).toBe("95447700900123");
  });
});

describe("samePhone", () => {
  const MM = "95";

  it("matches across formats", () => {
    expect(samePhone("09771234567", "+95 9 771 234 567", MM)).toBe(true);
  });

  it("falls back to the significant tail when codes disagree", () => {
    expect(samePhone("09771234567", "9771234567")).toBe(true);
  });

  it("rejects different numbers", () => {
    expect(samePhone("09771234567", "09771234568", MM)).toBe(false);
  });

  it("never matches on empty input", () => {
    expect(samePhone("", "", MM)).toBe(false);
    expect(samePhone("09771234567", "", MM)).toBe(false);
  });
});
