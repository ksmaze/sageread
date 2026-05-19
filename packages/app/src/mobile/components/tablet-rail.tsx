import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MOBILE_DESTINATIONS } from "../constants";
import type { MobileDestination } from "../types";

interface TabletRailProps {
  activeDestination: MobileDestination;
  onDestinationChange: (destination: MobileDestination) => void;
  hidden?: boolean;
}

export function TabletRail({ activeDestination, onDestinationChange, hidden = false }: TabletRailProps) {
  if (hidden) return null;

  return (
    <aside className="mobile-tonal-border hidden w-22 shrink-0 border-r bg-[var(--mobile-paper-low)] md:flex md:flex-col md:items-center md:gap-3 md:px-2 md:py-5">
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
              "h-16 min-h-[var(--mobile-touch-target)] w-full min-w-[var(--mobile-touch-target)] flex-col gap-1 rounded-lg text-[var(--mobile-ink-muted)] text-xs",
              isActive && "bg-[var(--mobile-paper-high)] text-[var(--mobile-ink)]",
            )}
            onClick={() => onDestinationChange(destination.id)}
          >
            <Icon className="size-5" />
            <span>{destination.label}</span>
          </Button>
        );
      })}
    </aside>
  );
}
