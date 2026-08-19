"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, Users, UserCog, Settings, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Admin sidebar navigation. The Staff link is admin-only. */
export function AdminNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const tp = useTranslations("adminPatients");
  const ts = useTranslations("adminStaff");
  const tr = useTranslations("reports");
  const tset = useTranslations("settings");

  const items = [
    { href: "/admin", label: tp("navAppointments"), Icon: CalendarDays },
    { href: "/admin/patients", label: tp("navPatients"), Icon: Users },
    { href: "/admin/reports", label: tr("navReports"), Icon: BarChart3 },
    ...(isAdmin
      ? [{ href: "/admin/staff", label: ts("navStaff"), Icon: UserCog }]
      : []),
    { href: "/admin/settings", label: tset("title"), Icon: Settings },
  ];

  return (
    <nav className="flex gap-1 sm:w-full sm:flex-col">
      {items.map(({ href, label, Icon }) => {
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
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
