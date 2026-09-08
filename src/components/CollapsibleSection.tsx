"use client";

import { useState, type ReactNode } from "react";
import { ChevronIcon } from "@/components/Icons";

export default function CollapsibleSection({
  title,
  description,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  badge,
  actions,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (controlledOpen === undefined) setUncontrolledOpen(next);
  };

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-md text-left outline-none hover:text-stone-950 focus-visible:ring-2 focus-visible:ring-teal-800/20"
        >
          <ChevronIcon
            className={`mt-0.5 h-4 w-4 shrink-0 text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
          />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-stone-900">
                {title}
              </span>
              {badge}
            </span>
            {description ? (
              <span className="mt-0.5 block text-xs text-stone-400">
                {description}
              </span>
            ) : null}
          </span>
        </button>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </section>
  );
}
