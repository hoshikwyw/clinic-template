import postgres from "postgres";
import { normalizePhone } from "../lib/phone";
import { getClinicConfig } from "../config/clinic";

/**
 * Backfill patients.phone_normalized for rows created before the column
 * existed.
 *
 *   pnpm backfill-phones           # show what would change
 *   pnpm backfill-phones --apply   # write it
 *
 * Why a script and not SQL in the migration: normalisation needs the clinic's
 * dialling code, which lives in ClinicConfig (`locale.phoneCountryCode`), not
 * in the database. A pure-SQL backfill would produce keys that disagree with
 * the ones the app writes at runtime, which is worse than leaving them null —
 * a null simply means "no dedupe match yet", a wrong value means "matched the
 * wrong patient".
 *
 * Safe to re-run: it only ever fills rows whose key is missing or stale.
 *
 * NOTE: talks to Postgres directly rather than importing db/index.ts, which
 * pulls in Next-flavoured modules that tsx cannot resolve — same reasoning as
 * scripts/set-role.ts.
 */
async function main() {
  const apply = process.argv.includes("--apply");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set (see .env.local).");
  }

  const dialCode = getClinicConfig().locale.phoneCountryCode;
  if (!dialCode) {
    console.warn(
      "! locale.phoneCountryCode is not set for this clinic — numbers will " +
        "only be stripped of formatting, so national and international forms " +
        "of the same number will NOT dedupe. Set it and re-run."
    );
  }

  const sql = postgres(connectionString, { prepare: false, max: 1 });

  try {
    const rows = await sql<
      { id: string; phone: string; phone_normalized: string | null }[]
    >`select id, phone, phone_normalized from patients`;

    const changes = rows
      .map((r) => ({ ...r, next: normalizePhone(r.phone, dialCode) || null }))
      .filter((r) => r.next !== r.phone_normalized);

    console.log(`${rows.length} patient(s); ${changes.length} need updating.`);
    if (changes.length === 0) return;

    if (!apply) {
      // Print the shape of the change, not the numbers — this runs against a
      // live clinic database and phone numbers are patient data.
      for (const c of changes.slice(0, 10)) {
        console.log(
          `  ${c.id}  ${c.phone_normalized ?? "(null)"} -> ${
            c.next ? `${c.next.length} digits` : "(null)"
          }`
        );
      }
      if (changes.length > 10) console.log(`  … and ${changes.length - 10} more`);
      console.log("\nDry run. Re-run with --apply to write.");
      return;
    }

    for (const c of changes) {
      await sql`update patients set phone_normalized = ${c.next} where id = ${c.id}`;
    }
    console.log(`✓ updated ${changes.length} patient row(s).`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
