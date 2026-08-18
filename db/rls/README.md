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

## Current policies

| Table | Policy | Effect |
|---|---|---|
| `patients` | `patients_self_select` / `patients_self_update` | a signed-in patient reads and updates only their own row (`auth.uid() = auth_user_id`). Guest rows have a null `auth_user_id`, so they are invisible to every browser client. |
| `appointments` | `appointments_self_select` | a patient sees only appointments belonging to their own patient record |
| `appointments` | `appointments_staff_select` | admin / doctor / staff read all appointments. Role comes from `auth.jwt() -> app_metadata`, never `user_metadata`, which the account holder can edit. Also what lets the staff browser receive Realtime events. |
| `rate_limits` | *(none)* | RLS enabled with no policies = denied to everyone. Only the trusted server connection touches it. |
| `audit_log` | *(none)* | same. The log records which staff member read which patient file, so it must not be browsable from a browser. |

## Testing

The app's own queries run on a trusted connection that **bypasses RLS**, so
nothing in normal operation would notice a broken policy. They are exercised
directly in [`tests/integration/rls.test.ts`](../../tests/integration/rls.test.ts),
which connects as the `authenticated` role with the same request GUCs Supabase
populates from a verified JWT:

```bash
pnpm test:integration
```
