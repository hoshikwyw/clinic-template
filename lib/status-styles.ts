/**
 * Single source of truth for appointment-status badge styling + order.
 * Light + dark aware. Used by the patient and admin views.
 */
export const STATUS_STYLES: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  confirmed: "bg-primary/10 text-primary",
  completed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  cancelled: "bg-muted text-muted-foreground",
};

/** Canonical display order for status breakdowns. */
export const STATUS_ORDER = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
] as const;
