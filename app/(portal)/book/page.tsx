import { getTranslations } from "next-intl/server";
import { getClinicConfig } from "@/config/clinic";
import { getSessionUser } from "@auth";
import { BookingWizard } from "@modules/appointments";
import type { FormSchema } from "@form-engine";

/**
 * Booking page — the focused booking wizard. Reached from the home CTA and the
 * services overview. Guest-accessible (no login needed to book).
 */
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const config = getClinicConfig();
  const t = await getTranslations("portal");
  const user = await getSessionUser();
  const { service: initialServiceId } = await searchParams;

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

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          {t("bookTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {user ? t("bookDescUser") : t("bookDescGuest")}
        </p>
      </header>
      <BookingWizard
        services={config.services}
        contactForm={contactForm}
        intakeForm={config.intakeForm}
        timeZone={config.locale.timezone}
        currency={config.locale.currency}
        initialServiceId={initialServiceId}
      />
    </div>
  );
}
