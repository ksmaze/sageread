import { MobileAiChat } from "../ai/mobile-ai-chat";
import { MobileSurface } from "../components/mobile-surface";

export function AiDestination() {
  return (
    <MobileSurface className="pb-20 md:pb-0">
      <div className="min-h-0 flex-1 px-4 pt-safe pb-3">
        <MobileAiChat />
      </div>
    </MobileSurface>
  );
}
