import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/utils/shadcn_utils";

const buttonVariants = cva(
  "inline-flex min-w-0 max-w-full cursor-pointer items-center justify-center gap-2 rounded-sm text-center text-base font-semibold whitespace-normal transition-colors disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[#005f5a] active:bg-[#005f5a]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:outline-destructive",
        outline:
          "border border-primary bg-white text-primary hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-6 py-2.5 has-[>svg]:px-4",
        sm: "min-h-11 gap-1.5 px-3 py-2 has-[>svg]:px-2.5",
        lg: "min-h-13 px-6 py-3.5 has-[>svg]:px-5",
        icon: "size-11 shrink-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
