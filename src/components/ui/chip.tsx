import type { ComponentProps } from "react";
import { Check } from "lucide-react";
import { cn } from "@/shared/utils/shadcn_utils";

export function Chip({
  selected = false,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "disabled:bg-muted disabled:text-muted-foreground inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-base transition-colors",
        selected
          ? "border-primary bg-accent border-2 px-[15px] font-semibold text-[#164b46]"
          : "border-input text-foreground hover:border-primary hover:text-primary bg-white",
        className,
      )}
      {...props}
    >
      <Check
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0 transition-opacity",
          selected ? "opacity-100" : "opacity-0",
        )}
      />
      {children}
    </button>
  );
}
