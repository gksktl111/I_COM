import * as React from "react";

import { cn } from "@/shared/utils/shadcn_utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input disabled:bg-muted disabled:text-muted-foreground flex h-11 w-full min-w-0 rounded-sm border bg-white px-3 py-2 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-white file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed",
        "focus:border-primary focus:outline-ring focus:outline-2 focus:outline-offset-2",
        "aria-invalid:border-destructive aria-invalid:outline-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
