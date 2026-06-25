import Link from "next/link";
import { redirect } from "next/navigation";
import { getClinicConfig } from "@/config/clinic";
import { getSessionUser } from "@auth";
import { signOut } from "@auth/actions";
import { BookingWizard } from "@modules/appointments";
import { getMyAppointments } from "@modules/appointments/server/booking";
import { ClinicThemeProvider } from "@ui";
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
  redirect("/portal");
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

export default async function PortalHome() {
  const config = getClinicConfig();
  const user = await getSessionUser();
  const appointments = user ? await getMyAppointments() : [];

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
    <ClinicThemeProvider branding={config.branding} className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            {config.branding.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user ? `Hi, ${user.fullName ?? user.email}` : "Welcome"}
          </p>
        </div>
        {user ? (
          <form action={handleSignOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        ) : (
          <Link href="/login">
            <Button variant="outline" size="sm">
              Log in
            </Button>
          </Link>
        )}
      </header>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your appointments</CardTitle>
            <CardDescription>
              {appointments.length === 0
                ? "No appointments yet — book one below."
                : "Newest first."}
            </CardDescription>
          </CardHeader>
          {appointments.length > 0 && (
            <CardContent className="space-y-2 text-sm">
              {appointments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-4"
                >
                  <span>
                    <span className="font-medium">{a.serviceName}</span>
                    <span className="block text-muted-foreground">
                      {fmt(a.startIso)}
                    </span>
                  </span>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Book an appointment</CardTitle>
          <CardDescription>
            {user
              ? "Booked under your account."
              : "No account needed — or log in to track your visits."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BookingWizard
            services={config.services}
            intakeForm={config.intakeForm}
            timeZone={config.locale.timezone}
            currency={config.locale.currency}
          />
        </CardContent>
      </Card>
    </ClinicThemeProvider>
  );
}
