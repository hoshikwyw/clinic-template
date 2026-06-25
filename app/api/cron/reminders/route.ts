import { NextResponse } from "next/server";
import { sendDueReminders } from "@modules/notifications";

/**
 * Reminder cron endpoint. Schedule this (e.g. Vercel Cron) to run periodically;
 * it emails reminders for appointments starting within the reminder window.
 *
 * Guarded by CRON_SECRET: callers must send `Authorization: Bearer <secret>`.
 * Vercel Cron sends this automatically when CRON_SECRET is set.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const result = await sendDueReminders();
  return NextResponse.json({ ok: true, ...result });
}
