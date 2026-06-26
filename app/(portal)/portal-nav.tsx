"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home, CalendarDays, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/portal", key: "home", Icon: Home },
  { href: "/appointments", key: "appointments", Icon: CalendarDays },
  { href: "/profile", key: "profile", Icon: User },
] as const;

/**
 * Patient app bottom navigation (mobile-first, thumb-reachable, 44px+ targets).
 * Shown only to logged-in patients. See docs/04-ui-ux-system.md.
 */
export function PortalNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-2xl grid-cols-3">
        {ITEMS.map(({ href, key, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" aria-hidden />
              {t(key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
