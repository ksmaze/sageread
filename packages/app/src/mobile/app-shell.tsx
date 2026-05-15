import SettingsDialog from "@/components/settings/settings-dialog";
import { useSafeAreaInsets } from "@/hooks/use-safe-areaInsets";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useLlamaStore } from "@/store/llama-store";
import { useEffect } from "react";
import { MobileBottomNav } from "./components/mobile-bottom-nav";
import { TabletRail } from "./components/tablet-rail";
import { AiDestination } from "./destinations/ai-destination";
import { LibraryDestination } from "./destinations/library-destination";
import { NotesDestination } from "./destinations/notes-destination";
import { StatsDestination } from "./destinations/stats-destination";
import { MobileReader } from "./reader/mobile-reader";
import { MobileSettingsEntry } from "./settings/mobile-settings-entry";
import { useMobileShellStore } from "./shell/mobile-shell-store";

function ActiveDestination() {
  const activeDestination = useMobileShellStore((state) => state.activeDestination);

  switch (activeDestination) {
    case "library":
      return <LibraryDestination />;
    case "notes":
      return <NotesDestination />;
    case "ai":
      return <AiDestination />;
    case "stats":
      return <StatsDestination />;
  }
}

export default function AndroidAppShell() {
  const insets = useSafeAreaInsets();
  const activeDestination = useMobileShellStore((state) => state.activeDestination);
  const setDestination = useMobileShellStore((state) => state.setDestination);
  const { isSettingsDialogOpen, toggleSettingsDialog } = useAppSettingsStore();
  const { hasHydrated, initializeEmbeddingService } = useLlamaStore();

  useEffect(() => {
    if (hasHydrated) {
      void initializeEmbeddingService();
    }
  }, [hasHydrated, initializeEmbeddingService]);

  if (!insets) return null;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--mobile-paper)] text-[var(--mobile-ink)]">
      <TabletRail activeDestination={activeDestination} onDestinationChange={setDestination} />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <ActiveDestination />
      </main>
      <MobileBottomNav activeDestination={activeDestination} onDestinationChange={setDestination} />
      <div className="pt-safe px-safe fixed top-2 right-2 z-40 md:top-3 md:right-3">
        <MobileSettingsEntry />
      </div>
      <MobileReader />
      <SettingsDialog open={isSettingsDialogOpen} onOpenChange={toggleSettingsDialog} />
    </div>
  );
}
