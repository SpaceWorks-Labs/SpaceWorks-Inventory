import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Rounded (16px), bordered table with 48px rows that scrolls inside its own box on small screens (docs/DESIGN.md §4.8).
 * `long` caps its height so long lists scroll inside the box with the header row kept in view.
 */
export function Table({ className, children, label, long = false, ...props }: HTMLAttributes<HTMLTableElement> & { label?: string; long?: boolean }) {
  return (
    // `relative` keeps absolutely positioned cell content (sr-only labels) inside the scroll area, so a wide table never widens the page.
    <div className={cn("relative w-full min-w-0 overflow-x-auto rounded-lg border border-line bg-panel", long && "max-h-[min(72vh,760px)] overflow-y-auto")} role="region" aria-label={label ?? "Data table"} tabIndex={0}>
      <table className={cn("w-full border-collapse text-left text-sm tabular-nums", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-surface", className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&>tr:last-child>td]:border-b-0", className)} {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors duration-[120ms] hover:bg-subtle", className)} {...props} />;
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn("sticky top-0 z-[1] h-12 whitespace-nowrap border-b border-line bg-surface px-4 py-2 text-sm font-semibold text-accent-text", className)} {...props} />;
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("h-12 border-b border-line px-4 py-2.5 align-middle text-ink", className)} {...props} />;
}
