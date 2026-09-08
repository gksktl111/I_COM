import type { ComponentProps, ReactNode } from "react";
import { Info, SearchX } from "lucide-react";
import { cn } from "@/shared/utils/shadcn_utils";

export function Notice({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex gap-3 border-y py-4 text-sm leading-relaxed",
        className,
      )}
      {...props}
    >
      <Info
        aria-hidden="true"
        className="text-primary mt-0.5 size-4 shrink-0"
      />
      <div>{children}</div>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center px-4 py-14 text-center"
      role="status"
    >
      <SearchX
        aria-hidden="true"
        className="text-muted-foreground/60 mb-4 size-10"
      />
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-2 max-w-md text-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-muted animate-pulse rounded", className)}
      {...props}
    />
  );
}
