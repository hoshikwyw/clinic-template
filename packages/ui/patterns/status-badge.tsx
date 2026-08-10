import { STATUS_STYLES } from "@/lib/status-styles";
import { cn } from "@/lib/utils";

/**
 * Appointment status pill. Single source for the badge markup that was inlined
 * across the admin + portal zones. `label` is the already-translated text.
 */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-current/10 ring-inset",
        STATUS_STYLES[status] ?? "",
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {label}
    </span>
  );
}
