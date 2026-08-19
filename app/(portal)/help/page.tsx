import { getTranslations } from "next-intl/server";
import { getClinicConfig } from "@/config/clinic";
import { formatOpenDays } from "@/lib/hours";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@ui/primitives/card";

/**
 * Help center — clinic contact details, opening hours, and a config-driven FAQ.
 * Guest-accessible. Content (contact + faq) is authored per clinic in its config.
 */
export default async function HelpPage() {
  const config = getClinicConfig();
  const t = await getTranslations("help");
  const tp = await getTranslations("public");
  const { contact, faq, businessHours } = config;
  const dayNames = tp.raw("dayNames") as string[];
  const hours = `${formatOpenDays(businessHours.openDays, dayNames)} · ${businessHours.openTime}–${businessHours.closeTime}`;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("contact")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {contact?.phone && (
            <div>
              <a
                href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                className="font-medium text-primary hover:underline"
              >
                {contact.phone}
              </a>
              <span className="text-muted-foreground"> · {t("call")}</span>
            </div>
          )}
          {contact?.email && (
            <div>
              <a
                href={`mailto:${contact.email}`}
                className="font-medium text-primary hover:underline"
              >
                {contact.email}
              </a>
              <span className="text-muted-foreground"> · {t("email")}</span>
            </div>
          )}
          {contact?.address && (
            <div className="text-muted-foreground">{contact.address}</div>
          )}
          <div className="pt-1">
            <span className="font-medium">{t("hours")}:</span>{" "}
            <span className="text-muted-foreground">{hours}</span>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("faq")}
        </h2>
        {faq.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noFaq")}</p>
        ) : (
          <div className="space-y-2">
            {faq.map((item, i) => (
              <details
                key={i}
                className="group rounded-xl border border-border p-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span
                    aria-hidden
                    className="text-muted-foreground transition-transform group-open:rotate-180"
                  >
                    ⌄
                  </span>
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
