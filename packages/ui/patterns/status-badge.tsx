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
        "rounded-md px-2 py-0.5 text-xs",
        STATUS_STYLES[status] ?? "",
        className
      )}
    >
      {label}
    </span>
  );
}
