import { createClient } from "@supabase/supabase-js";

/**
 * Assign a role to an existing user (sets the secure app_metadata.role).
 *
 *   pnpm set-role <email> [role]      role defaults to "admin"
 *
 * The user must already exist (have signed up). Roles: admin | staff | doctor |
 * patient. Uses the service role key, so run locally only.
 */
async function main() {
  const [email, role = "admin"] = process.argv.slice(2);
  if (!email) {
    console.error("Usage: pnpm set-role <email> [role]");
    process.exit(1);
  }

  // NOTE: this constructs the admin client inline rather than importing
  // createAdminClient() from lib/supabase/admin.ts on purpose. That module is
  // marked `server-only`, which tsx (used to run this script) cannot resolve.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find the user by email (paginate through users).
  let userId: string | undefined;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (match) {
      userId = match.id;
      break;
    }
    if (data.users.length < 200) break;
  }

  if (!userId) {
    console.error(`No user found with email ${email}. Have they signed up?`);
    process.exit(1);
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });
  if (error) throw error;

  console.log(`✓ set role="${role}" for ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
