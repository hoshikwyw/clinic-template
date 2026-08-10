import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Scaffold a new clinic config from config/clinics/_template.ts.
 *
 *   pnpm new-clinic <slug> ["Clinic Name"]
 *   pnpm new-clinic smile-dental "Smile Dental Clinic"
 *
 * Creates config/clinics/<slug>.ts with the export renamed and id/slug/name
 * filled in. Does NOT overwrite an existing file. Point config/clinic.ts at the
 * result to make it live.
 */

const CLINICS_DIR = join(process.cwd(), "config", "clinics");
const TEMPLATE = join(CLINICS_DIR, "_template.ts");

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

/** "my-clinic" -> "myClinic" (used as the export variable name). */
function toCamel(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function main() {
  const [slug, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ").trim();

  if (!slug) {
    fail('Usage: pnpm new-clinic <slug> ["Clinic Name"]');
  }
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    fail(
      `Invalid slug "${slug}". Use lowercase letters, digits, and hyphens (e.g. smile-dental).`
    );
  }

  const outPath = join(CLINICS_DIR, `${slug}.ts`);
  if (existsSync(outPath)) {
    fail(`config/clinics/${slug}.ts already exists — refusing to overwrite.`);
  }
  if (!existsSync(TEMPLATE)) {
    fail("config/clinics/_template.ts not found.");
  }

  const camel = toCamel(slug);
  const idSuffix = slug.replace(/-/g, "_");

  // Keep the import line; drop the template's long instructional header; then
  // apply the replacements to the config body.
  const template = readFileSync(TEMPLATE, "utf8");
  const marker = "export const templateClinic = defineClinicConfig({";
  const bodyStart = template.indexOf(marker);
  if (bodyStart === -1) {
    fail("Could not find the config body in _template.ts (was it edited?).");
  }

  const body = template
    .slice(bodyStart)
    .replace(marker, `export const ${camel} = defineClinicConfig({`)
    .replace('id: "clinic_template"', `id: "clinic_${idSuffix}"`)
    .replace('slug: "template-clinic"', `slug: "${slug}"`)
    .replace(
      'name: "Your Clinic Name"',
      `name: ${JSON.stringify(name || "Your Clinic Name")}`
    );

  const header = `import { defineClinicConfig } from "@config-engine";

/**
 * ${name || slug} — scaffolded from _template.ts. Fill in the values marked EDIT
 * (branding colors, services, intake form, hours, contact), then make it live in
 * config/clinic.ts:
 *
 *     import { ${camel} } from "./clinics/${slug}";
 *     const activeClinic = ${camel};
 */
`;

  writeFileSync(outPath, header + body, "utf8");

  console.log(`✓ Created config/clinics/${slug}.ts`);
  console.log("\nNext steps:");
  console.log(`  1. Edit config/clinics/${slug}.ts (fields marked EDIT)`);
  console.log(`  2. In config/clinic.ts:`);
  console.log(`       import { ${camel} } from "./clinics/${slug}";`);
  console.log(`       const activeClinic = ${camel};`);
  console.log(`  3. pnpm dev`);
}

main();
