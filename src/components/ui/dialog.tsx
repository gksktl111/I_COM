"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="text-foreground fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border bg-white p-0 shadow-xl backdrop:bg-slate-950/35"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-white px-6 py-3">
        <h2 id={titleId} className="text-lg font-bold">
          {title}
        </h2>
        <Button variant="ghost" size="icon" aria-label="닫기" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}
