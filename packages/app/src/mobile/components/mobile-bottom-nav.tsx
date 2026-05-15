import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MOBILE_DESTINATIONS } from "../constants";
import type { MobileDestination } from "../types";

interface MobileBottomNavProps {
  activeDestination: MobileDestination;
  onDestinationChange: (destination: MobileDestination) => void;
  hidden?: boolean;
}

export function MobileBottomNav({ activeDestination, onDestinationChange, hidden = false }: MobileBottomNavProps) {
  if (hidden) return null;

  return (
    <nav className="px-safe pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--mobile-paper-high)] mobile-tonal-border">
      <div className="grid h-16 grid-cols-4 px-2">
        {MOBILE_DESTINATIONS.map((destination) => {
          const Icon = destination.icon;
          const isActive = activeDestination === destination.id;

          return (
            <Button
              key={destination.id}
              type="button"
              variant="ghost"
              aria-label={destination.ariaLabel}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "h-full min-h-[var(--mobile-touch-target)] flex-col gap-1 rounded-none text-xs text-[var(--mobile-ink-muted)]",
                isActive && "text-[var(--mobile-ink)]",
              )}
              onClick={() => onDestinationChange(destination.id)}
            >
              <Icon className="size-5" />
              <span>{destination.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
