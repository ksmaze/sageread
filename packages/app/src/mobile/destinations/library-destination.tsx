import { useEffect } from "react";
import LibraryPage from "@/pages/library";
import type { ReaderNavigationTarget } from "@/pages/reader/store/create-reader-store";
import { useLayoutStore } from "@/store/layout-store";
import { MobileSurface } from "../components/mobile-surface";
import { useMobileShellStore } from "../shell/mobile-shell-store";

export function LibraryDestination() {
  const openMobileBook = useMobileShellStore((state) => state.openBook);

  useEffect(() => {
    const originalOpenBook = useLayoutStore.getState().openBook;
    useLayoutStore.setState({
      openBook: (bookId: string, title: string, navigationTarget?: ReaderNavigationTarget) => {
        openMobileBook({ id: bookId, title }, navigationTarget);
      },
    });

    return () => {
      useLayoutStore.setState({ openBook: originalOpenBook });
    };
  }, [openMobileBook]);

  return (
    <MobileSurface className="pb-20 md:pb-0">
      <LibraryPage renderSettingsDialog={false} />
    </MobileSurface>
  );
}
