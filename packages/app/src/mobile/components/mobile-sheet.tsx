import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import type { PropsWithChildren } from "react";

interface MobileSheetProps extends PropsWithChildren {
  open: boolean;
  title: string;
  description?: string;
  height?: "content" | "full";
  onOpenChange: (open: boolean) => void;
}

export function MobileSheet({
  open,
  title,
  description,
  height = "content",
  onOpenChange,
  children,
}: MobileSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        className={cn(
          "z-[100] border-[var(--mobile-outline)] bg-[var(--mobile-paper-high)]",
          height === "full" && "h-[calc(100dvh_-_env(safe-area-inset-top))]",
        )}
      >
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
        </DrawerHeader>
        <div className="mobile-scroll-area min-h-0 flex-1 overflow-y-auto px-4 pb-safe">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
