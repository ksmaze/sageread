import LibraryPage from "@/pages/library";
import { useLayoutStore } from "@/store/layout-store";
import { useEffect } from "react";
import { MobileSurface } from "../components/mobile-surface";
import { useMobileShellStore } from "../shell/mobile-shell-store";

export function LibraryDestination() {
  const openMobileBook = useMobileShellStore((state) => state.openBook);

  useEffect(() => {
    const originalOpenBook = useLayoutStore.getState().openBook;
    useLayoutStore.setState({
      openBook: (bookId: string, title: string) => {
        openMobileBook({ id: bookId, title });
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
