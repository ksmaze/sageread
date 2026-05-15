import LibraryPage from "@/pages/library";
import { MobileSurface } from "../components/mobile-surface";

export function LibraryDestination() {
  return (
    <MobileSurface className="pb-20 md:pb-0">
      <LibraryPage />
    </MobileSurface>
  );
}
