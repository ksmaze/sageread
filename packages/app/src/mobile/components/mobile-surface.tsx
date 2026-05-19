import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

interface MobileSurfaceProps extends PropsWithChildren {
  className?: string;
  padded?: boolean;
}

export function MobileSurface({ children, className, padded = true }: MobileSurfaceProps) {
  return (
    <section
      className={cn(
        "mobile-paper mobile-scroll-area flex min-h-0 flex-1 flex-col overflow-hidden",
        padded && "px-safe",
        className,
      )}
    >
      {children}
    </section>
  );
}
