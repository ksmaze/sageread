import SideChat from "@/components/side-chat";
import ChatPage from "@/pages/chat";

interface MobileAiChatProps {
  bookId?: string;
}

export function MobileAiChat({ bookId }: MobileAiChatProps) {
  if (bookId) {
    return <SideChat bookId={bookId} />;
  }

  return <ChatPage />;
}
