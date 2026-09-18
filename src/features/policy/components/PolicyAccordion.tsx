"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/utils/shadcn_utils";

export function PolicyAccordion({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <section
      className={cn("rounded-xl border border-slate-200 bg-white", className)}
    >
      <h3>
        <button
          type="button"
          id={`${id}-heading`}
          aria-expanded={open}
          aria-controls={`${id}-content`}
          onClick={() => setOpen((previous) => !previous)}
          className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-4 rounded-xl px-5 py-4 text-left text-base font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <span className="min-w-0 break-words">{title}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-5 shrink-0 text-slate-500 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </h3>
      <div
        id={`${id}-content`}
        aria-labelledby={`${id}-heading`}
        hidden={!open}
        className="border-t border-slate-100 px-5 py-5"
      >
        {children}
      </div>
    </section>
  );
}
