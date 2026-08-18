import postgres from "postgres";
import { getClinicConfig } from "../config/clinic";
import { getBookableProviders, getProvidersForService } from "../packages/config-engine";
import { normalizePhone } from "../lib/phone";
import { zonedWallTimeToUtc } from "../modules/scheduling/slots";

/**
 * Fill a clinic's database with believable demo data.
 *
 *   pnpm seed-demo            # dry run — says what it would create
 *   pnpm seed-demo --apply
 *   pnpm seed-demo --clean    # remove everything a previous seed created
 *
 * Why this exists: there is no way to show a prospect what the product does. An
 * empty deployment is an empty dashboard — no appointments, no patients, no
 * reports, nothing to look at. This produces a clinic mid-week: history behind
 * it, a full day ahead, a realistic mix of statuses, and appointments spread
 * across the configured providers and services.
 *
 * Safety. This writes patient-shaped rows, so it refuses to touch a database
 * that already has real data unless told to, and refuses outright in production
 * without an explicit acknowledgement. Everything it creates is tagged
 * `intake.__seed = "demo"` and `--clean` removes exactly that (appointments go
 * with their patient via ON DELETE CASCADE).
 *
 * Deterministic: a fixed-seed PRNG, so the same command produces the same
 * clinic every time and a demo never changes shape between runs.
 *
 * NOTE: talks to Postgres directly rather than importing db/index.ts, which
 * pulls in Next-flavoured modules that tsx cannot resolve — same reasoning as
 * scripts/set-role.ts.
 */

const SEED_TAG = "demo";

/** Mulberry32 — small, fast, and reproducible. */
function makeRng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20260818);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const chance = (p: number) => rng() < p;

const GIVEN = [
  "Aung", "Su", "Kyaw", "Thida", "Moe", "Nyein", "Hla", "Zin", "Khin", "Myat",
  "Phyu", "Wai", "Ye", "Nanda", "Ei", "Tun", "Sandar", "Kaung", "Yamin", "Htet",
] as const;
const FAMILY = [
  "Min", "Latt", "Zin", "Aye", "Moe", "Win", "Hlaing", "Oo", "Naing", "Thu",
  "Kyi", "Soe", "Maung", "Nwe", "Lwin",
] as const;

const STATUS_HISTORY = [
  // Weighted towards completed: a real clinic mostly sees its patients. The
  // no-shows and cancellations are what make the reports worth looking at.
  ...Array(12).fill("completed"),
  ...Array(3).fill("no_show"),
  ...Array(2).fill("cancelled"),
] as const;

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

/**
 * A clinic-local wall time on a given calendar day → UTC instant. Delegates to
 * the scheduling engine rather than re-deriving the offset here: that two-pass
 * DST resolution is subtle enough that a second copy would drift.
 */
function clinicTimeToUtc(day: Date, minutes: number, timeZone: string): Date {
  return zonedWallTimeToUtc(
    day.getUTCFullYear(),
    day.getUTCMonth() + 1,
    day.getUTCDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    timeZone
  );
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const clean = process.argv.includes("--clean");
  const force = process.argv.includes("--force");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("DATABASE_URL is not set (see .env.local).");

  if (process.env.NODE_ENV === "production" && !process.argv.includes("--yes-really")) {
    fail(
      "NODE_ENV=production. Refusing to seed a live clinic database. " +
        "Pass --yes-really if this genuinely is the demo deployment."
    );
  }

  const config = getClinicConfig();
  const tz = config.locale.timezone;
  const bh = config.businessHours;
  const providers = getBookableProviders(config);

  if (config.services.length === 0) fail("This clinic has no services to book.");

  const sql = postgres(connectionString!, { prepare: false, max: 1 });

  try {
    if (clean) {
      const [{ count }] = await sql<{ count: string }[]>`
        select count(*)::text from patients where intake->>'__seed' = ${SEED_TAG}
      `;
      const n = Number(count);
      if (!apply) {
        console.log(`Would delete ${n} seeded patient(s) and their appointments.`);
        console.log("\nDry run. Re-run with --apply to delete.");
        return;
      }
      await sql`delete from patients where intake->>'__seed' = ${SEED_TAG}`;
      console.log(`✓ removed ${n} seeded patient(s) and their appointments.`);
      return;
    }

    // Guard: never mix demo data into a database that has real patients.
    const [{ real }] = await sql<{ real: string }[]>`
      select count(*)::text as real
      from patients
      where intake->>'__seed' is distinct from ${SEED_TAG}
    `;
    if (Number(real) > 0 && !force) {
      fail(
        `This database already has ${real} non-seeded patient(s). ` +
          "Refusing to add demo data to what looks like a real clinic. " +
          "Pass --force if you are certain."
      );
    }

    // ---- Build the schedule -------------------------------------------------
    // 21 days back for history and reports, 10 forward so the dashboard has a
    // day to show. Uses the clinic's own open days, hours and slot size, so the
    // demo looks like the clinic actually described itself.
    const openMinutes = toMinutes(bh.openTime);
    const closeMinutes = toMinutes(bh.closeTime);
    const todayUtcMidnight = new Date(
      new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()) +
        "T00:00:00.000Z"
    );

    interface Row {
      patient: { name: string; phone: string; email: string | null; locale: string };
      serviceId: string;
      serviceName: string;
      providerId: string;
      providerName: string;
      startAt: Date;
      endAt: Date;
      status: string;
    }
    const rows: Row[] = [];
    const usedSlots = new Set<string>();

    for (let dayOffset = -21; dayOffset <= 10; dayOffset++) {
      const day = new Date(todayUtcMidnight.getTime() + dayOffset * 86_400_000);
      if (!bh.openDays.includes(day.getUTCDay())) continue;

      const isPast = dayOffset < 0;
      // A believable load: busier in the past (it happened), lighter ahead.
      const target = isPast ? 3 + Math.floor(rng() * 4) : 2 + Math.floor(rng() * 4);

      for (let i = 0; i < target; i++) {
        const service = pick(config.services);
        const eligible = getProvidersForService(config, service.id);
        if (eligible.length === 0) continue;
        const provider = pick(eligible);

        const slotCount = Math.floor(
          (closeMinutes - openMinutes - service.durationMinutes) / bh.slotMinutes
        );
        if (slotCount <= 0) continue;
        const minutes = openMinutes + Math.floor(rng() * slotCount) * bh.slotMinutes;

        const startAt = clinicTimeToUtc(day, minutes, tz);
        // Honour the same one-appointment-per-provider-per-time rule the unique
        // index enforces, or the insert would just fail.
        const key = `${provider.id}@${startAt.toISOString()}`;
        if (usedSlots.has(key)) continue;
        usedSlots.add(key);

        const given = pick(GIVEN);
        const family = pick(FAMILY);
        const name = `${given} ${family}`;
        const phone = `09${String(700000000 + Math.floor(rng() * 99999999)).slice(0, 9)}`;

        rows.push({
          patient: {
            name,
            phone,
            // Some patients book as guests with no email — that is the realistic
            // mix, and it is exactly why SMS matters.
            email: chance(0.6)
              ? `${given}.${family}`.toLowerCase() + "@demo.invalid"
              : null,
            locale: pick(config.locale.languages),
          },
          serviceId: service.id,
          serviceName: service.name,
          providerId: provider.id,
          providerName: provider.name,
          startAt,
          endAt: new Date(startAt.getTime() + service.durationMinutes * 60_000),
          status: isPast
            ? pick(STATUS_HISTORY)
            : chance(0.7)
              ? "confirmed"
              : "pending",
        });
      }
    }

    if (!apply) {
      const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {});
      console.log(`Would create ${rows.length} appointment(s) for ${config.branding.name}:`);
      for (const [status, n] of Object.entries(byStatus).sort()) {
        console.log(`  ${status.padEnd(10)} ${n}`);
      }
      console.log(`  across ${providers.length} provider(s), ${config.services.length} service(s)`);
      console.log("\nDry run. Re-run with --apply to write.");
      return;
    }

    // ---- Write --------------------------------------------------------------
    let created = 0;
    for (const r of rows) {
      const [patient] = await sql<{ id: string }[]>`
        insert into patients (full_name, phone, phone_normalized, email, locale, intake)
        values (
          ${r.patient.name},
          ${r.patient.phone},
          ${normalizePhone(r.patient.phone, config.locale.phoneCountryCode)},
          ${r.patient.email},
          ${r.patient.locale},
          ${sql.json({ __seed: SEED_TAG })}
        )
        returning id
      `;
      await sql`
        insert into appointments
          (patient_id, service_id, service_name, provider_id, provider_name,
           start_at, end_at, status, reminder_sent_at)
        values (
          ${patient.id}, ${r.serviceId}, ${r.serviceName},
          ${r.providerId}, ${r.providerName},
          ${r.startAt}, ${r.endAt}, ${r.status},
          ${r.startAt < new Date() ? r.startAt : null}
        )
      `;
      created++;
    }

    console.log(`✓ seeded ${created} appointment(s) and patient(s).`);
    console.log("  Remove them again with: pnpm seed-demo --clean --apply");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
