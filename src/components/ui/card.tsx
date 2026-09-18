import type { ComponentProps } from "react";
import { cn } from "@/shared/utils/shadcn_utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-lg border p-5 md:p-6",
        className,
      )}
      {...props}
    />
  );
}
