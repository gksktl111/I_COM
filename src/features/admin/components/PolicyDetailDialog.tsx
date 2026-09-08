"use client";

import { useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";

export function PolicyDetailDialog({
  title,
  children,
  triggerLabel = "상세 보기",
}: {
  title: string;
  children: ReactNode;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="admin-button admin-button-secondary"
        aria-haspopup="dialog"
        aria-label={`${title} ${triggerLabel}`}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        <div className="text-left text-sm font-normal break-words whitespace-normal">
          {children}
        </div>
      </Dialog>
    </>
  );
}
