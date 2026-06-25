import Link from "next/link";
import { redirect } from "next/navigation";
import { getClinicConfig } from "@/config/clinic";
import { getSessionUser, isStaff } from "@auth";
import { signOut } from "@auth/actions";
import {
  getAllAppointments,
  updateAppointmentStatus,
} from "@modules/appointments/server/admin";
import { Button } from "@ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ui/primitives/card";

async function handleSignOut() {
  "use server";
  await signOut();
  redirect("/admin/login");
}

async function changeStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  await updateAppointmentStatus(id, status);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    confirmed: "bg-primary/10 text-primary",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-muted text-muted-foreground line-through",
  };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}

export default async function AdminHome() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  if (!isStaff(user.role)) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
        <h1 className="text-xl font-semibold">Not authorized</h1>
        <p className="text-sm text-muted-foreground">
          This area is for clinic staff. You&apos;re signed in as{" "}
          {user.email}.
        </p>
        <form action={handleSignOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    );
  }

  const config = getClinicConfig();
  const appointments = await getAllAppointments();

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: config.locale.timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground">
            {config.branding.name} · signed in as {user.email}
          </p>
        </div>
        <form action={handleSignOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            All appointments ({appointments.length})
          </CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {appointments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No appointments yet.{" "}
              <Link href="/portal" className="underline">
                Try booking one
              </Link>
              .
            </p>
          )}
          {appointments.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-0.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.patientName}</span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="text-muted-foreground">
                  {a.serviceName} · {fmt(a.startIso)}
                </div>
                <div className="text-muted-foreground">{a.patientPhone}</div>
              </div>
              <form action={changeStatus} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={a.id} />
                <Button
                  type="submit"
                  name="status"
                  value="confirmed"
                  size="sm"
                  disabled={a.status === "confirmed"}
                >
                  Confirm
                </Button>
                <Button
                  type="submit"
                  name="status"
                  value="completed"
                  size="sm"
                  variant="outline"
                  disabled={a.status === "completed"}
                >
                  Complete
                </Button>
                <Button
                  type="submit"
                  name="status"
                  value="cancelled"
                  size="sm"
                  variant="ghost"
                  disabled={a.status === "cancelled"}
                >
                  Cancel
                </Button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
