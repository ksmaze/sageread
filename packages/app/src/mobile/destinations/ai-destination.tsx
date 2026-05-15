import { MobileAiChat } from "../ai/mobile-ai-chat";
import { MobileSurface } from "../components/mobile-surface";

export function AiDestination() {
  return (
    <MobileSurface className="pb-20 md:pb-0">
      <MobileAiChat />
    </MobileSurface>
  );
}
