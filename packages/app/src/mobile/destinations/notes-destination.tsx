import { MobileSurface } from "../components/mobile-surface";
import { UnifiedNotesPage } from "../notes/unified-notes-page";

export function NotesDestination() {
  return (
    <MobileSurface className="pb-20 md:pb-0">
      <UnifiedNotesPage className="p-4" />
    </MobileSurface>
  );
}
