import { cn } from "@/lib/utils";

/** Pulsing placeholder block for Suspense fallbacks / loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} aria-hidden />
  );
}
