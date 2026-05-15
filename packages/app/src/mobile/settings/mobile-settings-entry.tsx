import { Button } from "@/components/ui/button";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { Settings } from "lucide-react";

export function MobileSettingsEntry() {
  const { toggleSettingsDialog } = useAppSettingsStore();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="min-h-[var(--mobile-touch-target)] min-w-[var(--mobile-touch-target)] rounded-full"
      aria-label="打开设置"
      onClick={toggleSettingsDialog}
    >
      <Settings className="size-5" />
    </Button>
  );
}
