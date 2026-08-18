import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { parseClinicConfig, type ClinicConfigInput } from "@config-engine";
import * as schema from "@db/schema";
import {
  createTestDb,
  isDatabaseAvailable,
  TEST_DATABASE_URL,
  type TestDb,
} from "../helpers/test-db";

/**
 * End-to-end tests for the booking server actions, against a real database.
 *
 * tests/integration/schema.test.ts proves the *constraints* behave. This proves
 * the ~250 lines of application logic sitting on top of them behaves: that the
 * rate limiter is actually wired in, that a returning guest is really reused
 * rather than duplicated, that the per-patient daily cap is really enforced,
 * that "any available" really assigns a free provider, and that a patient
 * really cannot cancel someone else's appointment.
 *
 * None of that could be covered before: every one of these paths needs a
 * database, and the ones that matter most are the ones where a silent failure
 * looks exactly like success.
 *
 * The Next.js edges (request headers, locale, cache revalidation, session) are
 * mocked; everything below them — Drizzle, the SQL, the constraints — is real.
 */

const available = await isDatabaseAvailable();

if (!available) {
  describe.skip(`booking (no database at ${TEST_DATABASE_URL})`, () => {
    it("skipped", () => {});
  });
}

/** Mutable state the mocks read, so each test can set up its own world. */
const ctx = vi.hoisted(() => ({
  sessionUser: null as null | { id: string; email: string; role: string },
  locale: "en",
  ip: "203.0.113.1",
  // Assigned in beforeAll — the mock factories close over this object, not its
  // values, so they see the real instances once they exist.
  db: null as unknown,
  clinic: null as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": ctx.ip }),
}));
vi.mock("next-intl/server", () => ({ getLocale: async () => ctx.locale }));
vi.mock("@auth", () => ({
  getSessionUser: async () => ctx.sessionUser,
  requireStaff: async () => ctx.sessionUser,
  requireAdmin: async () => ctx.sessionUser,
}));
vi.mock("@db/index", () => ({
  get db() {
    return ctx.db;
  },
  schema,
}));
vi.mock("@/config/clinic", () => ({
  getClinicConfig: () => ctx.clinic,
}));

// Imported after the mocks are hoisted; the db is resolved lazily at call time.
const { createAppointment, getAvailableSlots, cancelMyAppointment } =
  await import("@modules/appointments/server/booking");

/** Two providers, both doing "checkup"; only Ada does "surgery". */
function clinicConfig(over: Partial<ClinicConfigInput> = {}) {
  return parseClinicConfig({
    id: "test",
    slug: "test",
    specialty: "dental",
    branding: { name: "Test Clinic", primaryColor: "#000" },
    locale: {
      languages: ["en", "my"],
      defaultLang: "en",
      timezone: "Asia/Yangon",
      currency: "MMK",
      phoneCountryCode: "95",
    },
    modules: {
      appointments: true,
      patients: true,
      scheduling: true,
      // Off: the notification path is covered by its own tests, and leaving it
      // on would print a no-op line per booking.
      notifications: false,
      billing: false,
      staff: false,
      telehealth: false,
    },
    services: [
      { id: "checkup", name: "Check-up", durationMinutes: 30 },
      { id: "surgery", name: "Surgery", durationMinutes: 30 },
    ],
    providers: [
      { id: "ada", name: "Dr. Ada", role: "Dentist" },
      { id: "ben", name: "Dr. Ben", role: "Dentist", serviceIds: ["checkup"] },
    ],
    bookingRules: { leadTimeHours: 0, cancellationWindowHours: 24 },
    businessHours: {
      openDays: [0, 1, 2, 3, 4, 5, 6],
      openTime: "09:00",
      closeTime: "17:00",
      slotMinutes: 30,
      // Small horizon: every call regenerates slots per provider, and these
      // tests only ever need a few days.
      bookingHorizonDays: 3,
    },
    ...over,
  });
}

describe.runIf(available)("booking actions", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
    ctx.db = drizzle(testDb.sql, { schema });
  }, 60_000);

  afterAll(async () => {
    await testDb?.close();
  });

  beforeEach(async () => {
    await testDb.truncate();
    ctx.sessionUser = null;
    ctx.locale = "en";
    ctx.ip = "203.0.113.1";
    ctx.clinic = clinicConfig();
  });

  /** First bookable slot for a service, so tests never guess at dates. */
  async function firstSlot(serviceId = "checkup", providerId?: string) {
    const days = await getAvailableSlots(serviceId, providerId);
    const slot = days[0]?.slots[0];
    if (!slot) throw new Error("no slots available");
    return slot;
  }

  const contact = {
    fullName: "Aye Aye",
    phone: "09771234567",
    email: "aye@example.mm",
  };

  async function countPatients() {
    const rows = await testDb.sql<{ n: string }[]>`
      select count(*)::text as n from patients
    `;
    return Number(rows[0].n);
  }

  // -------------------------------------------------------------------------
  describe("createAppointment", () => {
    it("books a slot and assigns the first eligible provider", async () => {
      const slot = await firstSlot();
      const res = await createAppointment({
        serviceId: "checkup",
        startIso: slot.startIso,
        contact,
      });

      expect(res.ok).toBe(true);
      // Config order is assignment order, so a clinic can express preference.
      expect(res.providerName).toBe("Dr. Ada");

      const [row] = await testDb.sql<{ provider_id: string; status: string }[]>`
        select provider_id, status from appointments
      `;
      expect(row.provider_id).toBe("ada");
      expect(row.status).toBe("pending");
    });

    it("honours a requested clinician", async () => {
      const slot = await firstSlot("checkup", "ben");
      const res = await createAppointment({
        serviceId: "checkup",
        startIso: slot.startIso,
        contact,
        providerId: "ben",
      });
      expect(res.providerName).toBe("Dr. Ben");
    });

    it("falls through to the next free provider when the first is busy", async () => {
      const slot = await firstSlot();
      await createAppointment({ serviceId: "checkup", startIso: slot.startIso, contact });

      // Same time, second patient — Ada is taken, so this must land on Ben
      // rather than being refused.
      ctx.ip = "203.0.113.2";
      const res = await createAppointment({
        serviceId: "checkup",
        startIso: slot.startIso,
        contact: { ...contact, phone: "09779999999", email: "b@example.mm" },
      });
      expect(res.ok).toBe(true);
      expect(res.providerName).toBe("Dr. Ben");
    });

    it("reports the slot gone only when every provider is busy", async () => {
      const slot = await firstSlot();
      for (const [i, phone] of ["09771111111", "09772222222"].entries()) {
        ctx.ip = `203.0.113.${10 + i}`;
        const r = await createAppointment({
          serviceId: "checkup",
          startIso: slot.startIso,
          contact: { ...contact, phone },
        });
        expect(r.ok).toBe(true);
      }

      ctx.ip = "203.0.113.20";
      const res = await createAppointment({
        serviceId: "checkup",
        startIso: slot.startIso,
        contact: { ...contact, phone: "09773333333" },
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("slotTaken");
    });

    it("distinguishes 'that clinician is busy' from 'the slot is gone'", async () => {
      const slot = await firstSlot();
      await createAppointment({ serviceId: "checkup", startIso: slot.startIso, contact });

      // Ada is busy but Ben is free — the patient can act on that, so the
      // message must not be the generic "slot taken".
      ctx.ip = "203.0.113.30";
      const res = await createAppointment({
        serviceId: "checkup",
        startIso: slot.startIso,
        contact: { ...contact, phone: "09774444444" },
        providerId: "ada",
      });
      expect(res.code).toBe("providerUnavailable");
    });

    it("rejects an unknown service and an unparseable time", async () => {
      const slot = await firstSlot();
      expect(
        (await createAppointment({ serviceId: "nope", startIso: slot.startIso, contact }))
          .code
      ).toBe("unknownService");
      expect(
        (await createAppointment({ serviceId: "checkup", startIso: "not-a-date", contact }))
          .code
      ).toBe("invalidTime");
    });

    it("refuses a slot outside the clinic's availability", async () => {
      // 03:00 Yangon — the clinic opens at 09:00. Availability is the only
      // gate, so a crafted payload must not slip past it.
      const res = await createAppointment({
        serviceId: "checkup",
        startIso: "2026-12-01T20:30:00.000Z",
        contact,
      });
      expect(res.ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe("guest deduplication", () => {
    it("reuses a returning guest across phone formats", async () => {
      const days = await getAvailableSlots("checkup");
      await createAppointment({
        serviceId: "checkup",
        startIso: days[0].slots[0].startIso,
        contact: { fullName: "Aye Aye", phone: "09 771 234 567" },
      });
      await createAppointment({
        serviceId: "checkup",
        startIso: days[0].slots[1].startIso,
        contact: { fullName: "Aye Aye", phone: "+95 9 771 234 567" },
      });

      // Without dedupe the staff directory fills with the same person under
      // slightly different formatting.
      expect(await countPatients()).toBe(1);
      const rows = await testDb.sql`select 1 from appointments`;
      expect(rows).toHaveLength(2);
    });

    it("keeps genuinely different people apart", async () => {
      const days = await getAvailableSlots("checkup");
      await createAppointment({
        serviceId: "checkup",
        startIso: days[0].slots[0].startIso,
        contact: { fullName: "A", phone: "09771234567" },
      });
      await createAppointment({
        serviceId: "checkup",
        startIso: days[0].slots[1].startIso,
        contact: { fullName: "B", phone: "09771234568" },
      });
      expect(await countPatients()).toBe(2);
    });

    it("never attaches a guest booking to a registered patient's record", async () => {
      const authId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
      await testDb.sql`
        insert into patients (auth_user_id, full_name, phone, phone_normalized)
        values (${authId}, 'Registered', '09771234567', '959771234567')
      `;

      const days = await getAvailableSlots("checkup");
      await createAppointment({
        serviceId: "checkup",
        startIso: days[0].slots[0].startIso,
        contact: { fullName: "Guest", phone: "09771234567" },
      });

      // A shared household number must not hand a stranger someone's record.
      expect(await countPatients()).toBe(2);
      const [row] = await testDb.sql<{ full_name: string }[]>`
        select full_name from patients where auth_user_id = ${authId}
      `;
      expect(row.full_name).toBe("Registered");
    });

    it("reuses a signed-in patient's own record", async () => {
      const authId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
      ctx.sessionUser = { id: authId, email: "me@example.mm", role: "patient" };

      const days = await getAvailableSlots("checkup");
      await createAppointment({
        serviceId: "checkup",
        startIso: days[0].slots[0].startIso,
        contact,
      });
      await createAppointment({
        serviceId: "checkup",
        startIso: days[0].slots[1].startIso,
        contact,
      });
      expect(await countPatients()).toBe(1);
    });

    it("stores the patient's language for their notifications", async () => {
      ctx.locale = "my";
      const slot = await firstSlot();
      await createAppointment({ serviceId: "checkup", startIso: slot.startIso, contact });
      const [row] = await testDb.sql<{ locale: string }[]>`
        select locale from patients
      `;
      expect(row.locale).toBe("my");
    });

    it("falls back to the clinic default for an unsupported language", async () => {
      ctx.locale = "fr";
      const slot = await firstSlot();
      await createAppointment({ serviceId: "checkup", startIso: slot.startIso, contact });
      const [row] = await testDb.sql<{ locale: string }[]>`
        select locale from patients
      `;
      expect(row.locale).toBe("en");
    });
  });

  // -------------------------------------------------------------------------
  describe("abuse limits", () => {
    it("blocks a caller hammering the endpoint from one IP", async () => {
      const days = await getAvailableSlots("checkup");
      const slots = days.flatMap((d) => d.slots);

      // The burst limit is 8 per 10 minutes. Vary the phone so the tighter
      // per-phone limit is not what trips first.
      let blocked = 0;
      for (let i = 0; i < 12; i++) {
        const res = await createAppointment({
          serviceId: "checkup",
          startIso: slots[i].startIso,
          contact: { fullName: "Spam", phone: `0977000${String(1000 + i)}` },
        });
        if (res.code === "rateLimited") blocked++;
      }

      // Unthrottled, this loop would consume the booking horizon.
      expect(blocked).toBeGreaterThan(0);
      expect(await countPatients()).toBeLessThan(12);
    });

    it("tells a blocked caller when to come back", async () => {
      const days = await getAvailableSlots("checkup");
      const slots = days.flatMap((d) => d.slots);
      let last;
      for (let i = 0; i < 12; i++) {
        last = await createAppointment({
          serviceId: "checkup",
          startIso: slots[i].startIso,
          contact: { fullName: "Spam", phone: `0977100${String(1000 + i)}` },
        });
      }
      expect(last?.code).toBe("rateLimited");
      expect(last?.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("counts the same number written differently against one bucket", async () => {
      const days = await getAvailableSlots("checkup");
      const slots = days.flatMap((d) => d.slots);
      const formats = [
        "09771234567",      // national, trunk 0
        "+959771234567",    // international
        "09 771 234 567",   // spaced
        "00959771234567",   // 00 international prefix
        "(09) 771-234-567", // punctuated
        "9771234567",       // bare national
        "959771234567",     // international, no +
      ];
      // Seven attempts against a limit of six, so the last must be refused.
      let blocked = 0;
      for (const [i, phone] of formats.entries()) {
        // Fresh IP each time, so only the per-phone limit can bite.
        ctx.ip = `198.51.100.${i + 1}`;
        const res = await createAppointment({
          serviceId: "checkup",
          startIso: slots[i].startIso,
          contact: { fullName: "Aye", phone },
        });
        if (res.code === "rateLimited") blocked++;
      }
      // Reformatting the number must not buy another allowance.
      expect(blocked).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("maxPerDayPerPatient", () => {
    beforeEach(() => {
      ctx.clinic = clinicConfig({
        bookingRules: {
          leadTimeHours: 0,
          cancellationWindowHours: 24,
          maxPerDayPerPatient: 1,
        },
      });
    });

    it("stops a second booking on the same day", async () => {
      const days = await getAvailableSlots("checkup");
      const sameDay = days[0].slots;

      expect(
        (await createAppointment({
          serviceId: "checkup",
          startIso: sameDay[0].startIso,
          contact,
        })).ok
      ).toBe(true);

      const res = await createAppointment({
        serviceId: "checkup",
        startIso: sameDay[1].startIso,
        contact,
      });
      // Declared in the config engine since day one; it went unenforced until
      // this rule was wired in.
      expect(res.code).toBe("dailyLimit");
    });

    it("allows a booking on a different day", async () => {
      const days = await getAvailableSlots("checkup");
      await createAppointment({
        serviceId: "checkup",
        startIso: days[0].slots[0].startIso,
        contact,
      });
      const res = await createAppointment({
        serviceId: "checkup",
        startIso: days[1].slots[0].startIso,
        contact,
      });
      expect(res.ok).toBe(true);
    });

    it("frees the allowance when the earlier booking is cancelled", async () => {
      const days = await getAvailableSlots("checkup");
      await createAppointment({
        serviceId: "checkup",
        startIso: days[0].slots[0].startIso,
        contact,
      });
      await testDb.sql`update appointments set status = 'cancelled'`;

      const res = await createAppointment({
        serviceId: "checkup",
        startIso: days[0].slots[1].startIso,
        contact,
      });
      expect(res.ok).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("cancelMyAppointment", () => {
    const OWNER = "aaaa1111-aaaa-1111-aaaa-111111111111";
    const OTHER = "bbbb2222-bbbb-2222-bbbb-222222222222";

    async function bookAs(authId: string, startIso: string) {
      ctx.sessionUser = { id: authId, email: "x@example.mm", role: "patient" };
      const res = await createAppointment({
        serviceId: "checkup",
        startIso,
        contact,
      });
      return res.appointmentId!;
    }

    it("refuses an unauthenticated caller", async () => {
      const slot = await firstSlot();
      const id = await bookAs(OWNER, slot.startIso);
      ctx.sessionUser = null;
      expect((await cancelMyAppointment(id)).error).toBe("unauthorized");
    });

    it("refuses someone else's appointment", async () => {
      const slot = await firstSlot();
      const id = await bookAs(OWNER, slot.startIso);

      // The ownership check is the only thing standing between a patient and
      // cancelling a stranger's appointment.
      ctx.sessionUser = { id: OTHER, email: "o@example.mm", role: "patient" };
      expect((await cancelMyAppointment(id)).error).toBe("notFound");

      const [row] = await testDb.sql<{ status: string }[]>`
        select status from appointments where id = ${id}
      `;
      expect(row.status).toBe("pending");
    });

    it("cancels the caller's own appointment", async () => {
      // Far enough ahead to clear the 24-hour window.
      const days = await getAvailableSlots("checkup");
      const slot = days[days.length - 1].slots[0];
      const id = await bookAs(OWNER, slot.startIso);

      expect((await cancelMyAppointment(id)).ok).toBe(true);
      const [row] = await testDb.sql<{ status: string }[]>`
        select status from appointments where id = ${id}
      `;
      expect(row.status).toBe("cancelled");
    });

    it("enforces the cancellation window", async () => {
      const days = await getAvailableSlots("checkup");
      const id = await bookAs(OWNER, days[0].slots[0].startIso);

      // Move it to two hours away, inside the 24-hour window.
      await testDb.sql`
        update appointments set start_at = now() + interval '2 hours' where id = ${id}
      `;
      expect((await cancelMyAppointment(id)).error).toBe("window");
    });

    it("refuses to cancel twice", async () => {
      const days = await getAvailableSlots("checkup");
      const id = await bookAs(OWNER, days[days.length - 1].slots[0].startIso);
      await cancelMyAppointment(id);
      expect((await cancelMyAppointment(id)).error).toBe("alreadyEnded");
    });
  });
});
