import { NextResponse } from "next/server";
import { getSessionUser, isStaff } from "@auth";
import { getAllAppointments } from "@modules/appointments/server/admin";
import { getClinicConfig } from "@/config/clinic";

/** RFC 4180 cell escaping. */
function cell(value: string): string {
  return /[",\n\r]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

/**
 * GET /admin/export — download all appointments as CSV. Staff only.
 * UTF-8 BOM so Excel reads non-Latin (e.g. Burmese) names correctly.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const config = getClinicConfig();
  const appts = await getAllAppointments();

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: config.locale.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));

  const header = ["Patient", "Phone", "Service", "When", "Status"];
  const rows = appts.map((a) => [
    a.patientName,
    a.patientPhone,
    a.serviceName,
    fmt(a.startIso),
    a.status,
  ]);

  const csv =
    "﻿" +
    [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="appointments-${date}.csv"`,
    },
  });
}
