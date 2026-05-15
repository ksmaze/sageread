import { useMobileShellStore } from "../shell/mobile-shell-store";

export function handleMobileReaderBack(): boolean {
  const state = useMobileShellStore.getState();

  if (state.activeReaderSheet) {
    state.closeReaderSheet();
    return true;
  }

  if (state.isReaderChromeVisible) {
    state.hideReaderChrome();
    return true;
  }

  if (state.isReaderOpen) {
    state.closeReader();
    return true;
  }

  return false;
}
