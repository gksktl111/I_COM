import type { ComponentProps } from "react";
import { cn } from "@/shared/utils/shadcn_utils";

export function Chip({
  selected = false,
  className,
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors disabled:opacity-50",
        selected
          ? "border-primary bg-accent text-primary font-semibold"
          : "text-muted-foreground hover:border-primary hover:text-primary bg-white",
        className,
      )}
      {...props}
    />
  );
}
