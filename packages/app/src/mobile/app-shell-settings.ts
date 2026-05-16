import type { MobileDestination } from "./types";

export function shouldShowShellSettingsEntry(activeDestination: MobileDestination): boolean {
  return activeDestination !== "ai";
}
