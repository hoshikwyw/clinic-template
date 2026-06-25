# Setup & Deployment Checklist

Practical steps to run the app locally and deploy a clinic. (Architecture lives
in the other docs; this is the hands-on checklist.)

## Local development

1. **Install deps:** `pnpm install`
2. **Env:** copy `.env.example` → `.env.local`, fill the Supabase values:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY` — Supabase **Settings → API**
   - `DATABASE_URL` — the **direct** connection (port 5432) for local
     migrations + dev. (Supabase **Connect** dialog.)
3. **Apply DB migrations:** `pnpm db:migrate`
4. **Run:** `pnpm dev` → http://localhost:3000

### Smooth dev login (disable email confirmation)

So new signups log in immediately instead of waiting on a confirmation email:

- Supabase dashboard → **Authentication → Sign In / Providers → Email**
- Turn **off** "Confirm email" → **Save**
- (If a test user got stuck unconfirmed: **Authentication → Users** → delete it,
  or open it and confirm manually.)

Re-enable this for **production** (with real SMTP).

### Make yourself an admin

1. Sign up at `/signup` (creates an account + patient record)
2. `pnpm set-role you@example.com admin`
3. Visit `/admin` → log in → manage appointments

## Email (optional)

Without `RESEND_API_KEY`, appointment emails are **console no-ops** (logged, not
sent) — everything still works. To actually send:

- Set `RESEND_API_KEY` and `EMAIL_FROM` (a Resend-verified domain) in `.env.local`.

## Configure the clinic

- Edit **`config/clinic.ts`** — it points at this deployment's clinic config.
- A clinic config (branding, services, intake form, business hours, modules)
  lives in `config/clinics/`. Copy an example to make a new client.

## Deploy to Vercel

1. Push the repo and import it into Vercel.
2. Set **Environment Variables** in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`
   - **`DATABASE_URL` = the TRANSACTION POOLER URI (port 6543)** — Supabase
     **Connect → Transaction**. Serverless needs the pooler; the code already
     sets `prepare: false`, which the pooler requires.
   - `RESEND_API_KEY` / `EMAIL_FROM` (optional), `CRON_SECRET`
3. Keep **local** `.env.local` on the **direct** connection (5432) — migrations
   can't run over the transaction pooler. So: local = direct, Vercel = pooler.
4. The reminder cron is already scheduled in `vercel.json` (hourly →
   `/api/cron/reminders`), authenticated with `CRON_SECRET`.
5. Re-enable Supabase "Confirm email" for production.

## One clinic = one deployment

Single-tenant: each clinic gets its own Vercel project + its own Supabase
project + its own `config/clinic.ts`. See [00 — Overview](./00-overview.md).
