import type { ComponentProps } from "react";
import { cn } from "@/shared/utils/shadcn_utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-xl border p-5 shadow-xs",
        className,
      )}
      {...props}
    />
  );
}
