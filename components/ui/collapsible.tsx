"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

function readSaved(key: string): boolean | null {
  try {
    const saved = window.localStorage.getItem(key);
    return saved === "open" ? true : saved === "closed" ? false : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function save(key: string, open: boolean) {
  try {
    window.localStorage.setItem(key, open ? "open" : "closed");
  } catch {
    // Private windows and blocked storage just forget the choice.
  }
}

/**
 * Open/closed state remembered in this browser under `storageKey`. The server
 * and the first client render use `defaultOpen`; the saved choice applies
 * after hydration.
 */
export function useRememberedOpen(storageKey: string, defaultOpen: boolean): [boolean, () => void] {
  const saved = useSyncExternalStore(subscribe, () => readSaved(storageKey), () => null);
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = choice ?? saved ?? defaultOpen;
  return [open, () => {
    save(storageKey, !open);
    setChoice(!open);
  }];
}

/**
 * A card whose body folds away behind its title. Starts from `defaultOpen`
 * (empty sections start closed) and then remembers this browser's choice.
 */
export function CollapsibleCard({
  id, title, count, action, defaultOpen = true, titleAs: Title = "h2", children,
}: {
  id: string;
  title: string;
  count?: number;
  action?: ReactNode;
  defaultOpen?: boolean;
  titleAs?: "h2" | "h3";
  children: ReactNode;
}) {
  const [open, toggle] = useRememberedOpen(`swi:dash:${id}`, defaultOpen);
  const bodyId = useId();

  return (
    <section className="min-w-0 rounded-xl border border-line bg-panel">
      <div className="flex items-center gap-2 pr-3">
        <Title className="min-w-0 flex-1">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={bodyId}
            className="flex min-h-14 w-full items-center gap-2 rounded-xl px-5 text-left text-title text-ink transition-colors hover:bg-surface"
          >
            <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-ink-muted transition-transform duration-[160ms] motion-reduce:transition-none", !open && "-rotate-90")} />
            <span className="min-w-0 truncate">{title}</span>
            {count !== undefined ? (
              <span className="min-w-6 rounded-full bg-surface px-2 text-center text-caption font-semibold leading-6 tabular-nums text-ink-secondary">{count}</span>
            ) : null}
          </button>
        </Title>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      <div id={bodyId} hidden={!open} className="px-5 pb-5">
        {children}
      </div>
    </section>
  );
}
