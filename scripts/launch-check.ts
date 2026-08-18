import { statSync } from "node:fs";
import { join } from "node:path";
import { runLaunchChecks, hasBlockingFindings } from "../packages/config-engine";
import type { CheckFinding } from "../packages/config-engine";
import { getClinicConfig } from "../config/clinic";

/**
 * Pre-launch readiness audit for this deployment.
 *
 *   pnpm launch-check
 *   pnpm launch-check --config-only   # skip anything that reads the environment
 *
 * Exits non-zero when anything would break for real patients, so it can gate a
 * deploy in CI as well as being run by hand. The checklist itself lives in
 * packages/config-engine/launch-check.ts (pure, unit-tested); this only gathers
 * the inputs and prints the report.
 *
 * Companion to docs/09-new-clinic-checklist.md — that is the human version, this
 * is the part a machine can verify.
 */

/** Assets that must be the clinic's own before launch. */
const ICON_PATHS = ["app/icon.svg", "app/favicon.ico", "public/icon.svg"];

/**
 * Byte sizes of the starter assets that ship with the template. Matching one
 * means nobody swapped the icon. Cheap and good enough — the point is a nudge,
 * not forensics.
 */
const STARTER_ICON_SIZES = new Set([25931, 385]);

function inspectIcons() {
  const icons: { path: string; exists: boolean; isPlaceholder?: boolean }[] = [];
  for (const rel of ICON_PATHS) {
    try {
      const s = statSync(join(process.cwd(), rel));
      icons.push({
        path: rel,
        exists: true,
        isPlaceholder: STARTER_ICON_SIZES.has(s.size),
      });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        icons.push({ path: rel, exists: false });
      } else {
        // Unreadable for some other reason (permissions). Say so rather than
        // reporting a missing file we cannot actually see.
        return undefined;
      }
    }
  }
  return icons;
}

const LEVEL_MARK = { error: "✗", warn: "⚠", info: "·" } as const;

function print(findings: CheckFinding[]) {
  const byArea = new Map<string, CheckFinding[]>();
  for (const f of findings) {
    const list = byArea.get(f.area);
    if (list) list.push(f);
    else byArea.set(f.area, [f]);
  }

  for (const [area, list] of byArea) {
    console.log(`\n${area}`);
    for (const f of list) {
      console.log(`  ${LEVEL_MARK[f.level]} ${f.message}`);
      if (f.fix) console.log(`      → ${f.fix}`);
    }
  }
}

function main() {
  // CI has no secrets, so env findings there are noise rather than signal — but
  // the config half (template text, expired holidays, an unfinished clinic) is
  // still worth failing a merge on.
  const configOnly = process.argv.includes("--config-only");
  const config = getClinicConfig();

  console.log(
    `Launch check — ${config.branding.name} (${config.slug})` +
      (configOnly ? " [config only]" : "")
  );

  const findings = runLaunchChecks({
    config,
    env: process.env,
    icons: inspectIcons(),
  }).filter((f) => !(configOnly && f.dependsOnEnv));

  const errors = findings.filter((f) => f.level === "error").length;
  const warns = findings.filter((f) => f.level === "warn").length;

  if (findings.length === 0) {
    console.log("\n✓ Ready to launch — nothing flagged.");
    return;
  }

  print(findings);

  console.log(
    `\n${errors} blocking, ${warns} warning(s), ` +
      `${findings.length - errors - warns} note(s).`
  );

  if (hasBlockingFindings(findings)) {
    console.log("✗ Not ready to launch.");
    process.exit(1);
  }
  console.log("✓ No blocking problems.");
}

// The config itself is validated on load, so a malformed one throws here with
// Zod's own message — which is the right report to show.
try {
  main();
} catch (err) {
  console.error("✗ Could not run the launch check:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
