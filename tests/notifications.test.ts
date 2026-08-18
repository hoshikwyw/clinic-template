import { describe, it, expect } from "vitest";
import { parseClinicConfig, safeParseClinicConfig } from "@config-engine";
import {
  bookedSms,
  statusSms,
  reminderSms,
  bookedEmail,
  reminderEmail,
} from "@modules/notifications";
import { toE164 } from "@/lib/phone";
import { smileDental } from "@/config/clinics/smile-dental";
import { littleStarsPediatric } from "@/config/clinics/little-stars-pediatric";

const dental = parseClinicConfig(smileDental);
const pediatric = parseClinicConfig(littleStarsPediatric);

const appt = {
  patientName: "Aye Aye",
  serviceName: "Dental Check-up",
  startIso: "2026-07-01T02:30:00.000Z", // 09:00 in Yangon
};

describe("toE164", () => {
  it("builds a routable number from any national format", () => {
    expect(toE164("09 771 234 567", "95")).toBe("+959771234567");
    expect(toE164("+95 9 771 234 567", "95")).toBe("+959771234567");
  });

  it("refuses without a dialling code", () => {
    // A bare national number is not routable; sending it anyway would fail at
    // the gateway or, worse, reach someone in another country.
    expect(toE164("09771234567")).toBeNull();
  });

  it("refuses obvious junk", () => {
    expect(toE164("12345", "95")).toBeNull();
    expect(toE164("", "95")).toBeNull();
  });
});

describe("SMS templates", () => {
  it("carry the clinic name and are free of HTML", () => {
    for (const text of [
      bookedSms(dental, appt),
      statusSms(dental, { ...appt, status: "confirmed" }),
      reminderSms(dental, appt),
    ]) {
      expect(text).toContain("Smile Dental Clinic");
      expect(text).not.toMatch(/<[a-z/]/i);
      expect(text).toContain("Dental Check-up");
    }
  });

  it("name the clinician when there is one", () => {
    const withDoc = reminderSms(dental, { ...appt, providerName: "Dr. Aung Min" });
    expect(withDoc).toContain("Dr. Aung Min");
    // …and stay quiet when the clinic runs a single calendar.
    expect(reminderSms(dental, appt)).not.toContain("with ");
  });

  it("follow the patient's language, not the clinic default", () => {
    const en = bookedSms(dental, { ...appt, locale: "en" });
    const my = bookedSms(dental, { ...appt, locale: "my" });
    expect(en).not.toBe(my);
    // Burmese script present.
    expect(my).toMatch(/[က-႟]/);
  });

  it("fall back to the clinic default for an unsupported language", () => {
    expect(bookedSms(dental, { ...appt, locale: "fr" })).toBe(
      bookedSms(dental, { ...appt, locale: "en" })
    );
  });

  it("stay short enough to be worth sending", () => {
    // Burmese is non-Latin, so an SMS segment is 70 characters, not 160. This
    // is a cost guard, not a hard limit — if a template grows past ~4 segments
    // someone should have decided that deliberately.
    const my = reminderSms(dental, { ...appt, locale: "my" });
    expect(my.length).toBeLessThan(280);
  });
});

describe("email templates", () => {
  it("escape patient-supplied names", () => {
    const { html } = bookedEmail(dental, {
      ...appt,
      patientName: '<script>alert("x")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("name the clinician when there is one", () => {
    const { html } = reminderEmail(dental, {
      ...appt,
      providerName: "Dr. Su Latt",
    });
    expect(html).toContain("Dr. Su Latt");
  });
});

describe("notification config", () => {
  it("reads channels and reminder timing from the clinic", () => {
    expect(dental.notifications.channels).toEqual(["email", "sms"]);
    expect(dental.notifications.reminderHoursBefore).toBe(24);
    // A pediatric clinic wants a same-morning nudge, not a day-ahead one.
    expect(pediatric.notifications.channels).toEqual(["sms"]);
    expect(pediatric.notifications.reminderHoursBefore).toBe(3);
  });

  it("defaults to email only", () => {
    const c = parseClinicConfig({ ...smileDental, notifications: undefined });
    expect(c.notifications.channels).toEqual(["email"]);
    expect(c.notifications.reminderHoursBefore).toBe(24);
  });

  it("rejects SMS without a dialling code", () => {
    // Otherwise every message is dropped before the gateway and the clinic
    // believes reminders are going out.
    const r = safeParseClinicConfig({
      ...smileDental,
      locale: { ...smileDental.locale, phoneCountryCode: undefined },
      notifications: { channels: ["sms"] },
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty channel list", () => {
    const r = safeParseClinicConfig({
      ...smileDental,
      notifications: { channels: [] },
    });
    expect(r.success).toBe(false);
  });
});
