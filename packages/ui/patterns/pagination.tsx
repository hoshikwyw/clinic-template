import Link from "next/link";

/**
 * Prev/next pager for server-rendered list pages. `hrefForPage` builds the URL
 * for a target page (preserving the page's own query params). Renders nothing
 * when there's a single page. Labels are passed in already-translated.
 */
export function Pagination({
  page,
  totalPages,
  hrefForPage,
  prevLabel,
  nextLabel,
  summary,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  prevLabel: string;
  nextLabel: string;
  /** e.g. "Page 2 of 5" */
  summary: string;
}) {
  if (totalPages <= 1) return null;

  const linkCls =
    "inline-flex min-h-9 items-center rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-muted";
  const disabledCls =
    "inline-flex min-h-9 items-center rounded-md border border-border px-3 text-sm font-medium opacity-40";

  return (
    <nav className="flex items-center justify-between gap-2 pt-2">
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className={linkCls}>
          ← {prevLabel}
        </Link>
      ) : (
        <span className={disabledCls} aria-disabled>
          ← {prevLabel}
        </span>
      )}

      <span className="text-xs text-muted-foreground">{summary}</span>

      {page < totalPages ? (
        <Link href={hrefForPage(page + 1)} className={linkCls}>
          {nextLabel} →
        </Link>
      ) : (
        <span className={disabledCls} aria-disabled>
          {nextLabel} →
        </span>
      )}
    </nav>
  );
}
