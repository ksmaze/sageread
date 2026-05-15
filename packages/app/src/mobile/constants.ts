import { BarChart3, Bot, Library, NotebookTabs, type LucideIcon } from "lucide-react";
import type { MobileDestination, MobileDestinationDefinition } from "./types";

export const MOBILE_TABLET_MIN_WIDTH = 720;

export interface MobileDestinationConfig extends MobileDestinationDefinition {
  icon: LucideIcon;
}

export const MOBILE_DESTINATIONS: MobileDestinationConfig[] = [
  { id: "library", label: "书库", ariaLabel: "打开书库", icon: Library },
  { id: "notes", label: "笔记", ariaLabel: "打开笔记", icon: NotebookTabs },
  { id: "ai", label: "AI", ariaLabel: "打开 AI 助手", icon: Bot },
  { id: "stats", label: "统计", ariaLabel: "打开阅读统计", icon: BarChart3 },
];

export function isMobileDestination(value: string): value is MobileDestination {
  return MOBILE_DESTINATIONS.some((destination) => destination.id === value);
}
