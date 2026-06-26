"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", key: "navAppointments", Icon: CalendarDays },
  { href: "/admin/patients", key: "navPatients", Icon: Users },
] as const;

/** Admin sidebar navigation (Appointments / Patients). */
export function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations("adminPatients");

  return (
    <nav className="flex gap-1 sm:w-full sm:flex-col">
      {ITEMS.map(({ href, key, Icon }) => {
        const active =
          href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-2 rounded-md px-2.5 text-sm transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
