# Row-Level Security (RLS)

This deployment serves **one clinic** (single-tenant). The database holds that
clinic's data only — there is **no clinic_id / tenant isolation** to enforce.

RLS is still used, but for **role-based access *within* the clinic**:

- **Patients** can read/write only their **own** records (`auth.uid()` match).
- **Doctors / staff** can read the clinic's operational data per their role.
- **Admins** (the clinic's own admin team) get broader access via the dashboard.
- The **service role** bypasses RLS for trusted server-side operations.

## Where policies live

RLS is defined **inline in the Drizzle schema** (`db/schema/*.ts`) using
`pgPolicy(...)` + `.enableRLS()`, so policies are versioned and ship inside the
generated migrations (`db/migrations/`).

## Status

- No operational tables yet. Patients / appointments tables + their role-based
  policies land in Phase 2 alongside auth.
