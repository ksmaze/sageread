import { Languages, NotebookPen } from "lucide-react";
import type React from "react";
import { FiCopy, FiHelpCircle, FiMessageCircle } from "react-icons/fi";
import { PiHighlighterFill } from "react-icons/pi";
import { RiDeleteBinLine } from "react-icons/ri";
import type { OsPlatform } from "@/types/system";

export interface SelectionPopupButton {
  label: string | undefined;
  Icon: React.ElementType;
  onClick: () => void;
  separatorAfter?: boolean;
}

interface SelectionPopupActionsOptions {
  osPlatform: OsPlatform;
  onCopy: () => void;
  onTranslate: () => void;
  onExplain: () => void;
  onAskAi: () => void;
  onHighlight: () => void;
  onAddNote: () => void;
  selectionAnnotated: boolean;
}

export const getSelectionPopupButtons = ({
  osPlatform,
  onCopy,
  onTranslate,
  onExplain,
  onAskAi,
  onHighlight,
  onAddNote,
  selectionAnnotated,
}: SelectionPopupActionsOptions): SelectionPopupButton[] => {
  const askAiButton: SelectionPopupButton = {
    label: "询问AI",
    Icon: FiMessageCircle,
    onClick: onAskAi,
    separatorAfter: true,
  };

  return [
    { label: "复制", Icon: FiCopy, onClick: onCopy },
    ...(osPlatform === "android" ? [{ label: "翻译", Icon: Languages, onClick: onTranslate }] : []),
    { label: "解释", Icon: FiHelpCircle, onClick: onExplain },
    askAiButton,
    {
      label: undefined,
      Icon: selectionAnnotated ? RiDeleteBinLine : PiHighlighterFill,
      onClick: onHighlight,
    },
    { label: undefined, Icon: NotebookPen, onClick: onAddNote },
  ];
};
