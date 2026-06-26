import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getClinicConfig } from "@/config/clinic";
import { getSessionUser } from "@auth";
import { signOut } from "@auth/actions";
import { BookingWizard } from "@modules/appointments";
import { getMyAppointments } from "@modules/appointments/server/booking";
import type { FormSchema } from "@form-engine";
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
  const t = await getTranslations("portal");
  const locale = await getLocale();
  const user = await getSessionUser();
  const appointments = user ? await getMyAppointments() : [];

  // Canonical contact fields (names fixed; labels come from the clinic config).
  const contactForm: FormSchema = [
    {
      name: "fullName",
      label: config.bookingContact.nameLabel,
      type: "text",
      required: true,
    },
    {
      name: "phone",
      label: config.bookingContact.phoneLabel,
      type: "phone",
      required: true,
    },
    {
      name: "email",
      label: config.bookingContact.emailLabel,
      type: "email",
      required: false,
    },
  ];

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
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
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            {config.branding.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user
              ? t("greeting", { name: user.fullName ?? user.email })
              : t("welcome")}
          </p>
        </div>
        {user ? (
          <form action={handleSignOut}>
            <Button type="submit" variant="outline" size="sm">
              {t("signOut")}
            </Button>
          </form>
        ) : (
          <Link href="/login">
            <Button variant="outline" size="sm">
              {t("logIn")}
            </Button>
          </Link>
        )}
      </header>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("apptTitle")}</CardTitle>
            <CardDescription>
              {appointments.length === 0 ? t("apptEmpty") : t("apptNewest")}
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
          <CardTitle className="text-base">{t("bookTitle")}</CardTitle>
          <CardDescription>
            {user ? t("bookDescUser") : t("bookDescGuest")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BookingWizard
            services={config.services}
            contactForm={contactForm}
            intakeForm={config.intakeForm}
            timeZone={config.locale.timezone}
            currency={config.locale.currency}
          />
        </CardContent>
      </Card>
    </div>
  );
}
