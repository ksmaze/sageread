import HomeLayout from "@/components/home-layout";
import { NotepadContainer } from "@/components/notepad";
import NotificationDropdown from "@/components/notification-dropdown";
import SettingsDialog from "@/components/settings/settings-dialog";
import SideChat from "@/components/side-chat";
import WindowControls from "@/components/window-controls";
import { useFontEvents } from "@/hooks/use-font-events";
import ReaderViewer from "@/pages/reader";
import { ReaderProvider } from "@/pages/reader/components/reader-provider";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useLayoutStore } from "@/store/layout-store";
import { useThemeStore } from "@/store/theme-store";
import { getOSPlatform } from "@/utils/misc";
import { Tabs } from "app-tabs";
import { HomeIcon } from "lucide-react";
import { Resizable } from "re-resizable";
import { useEffect, useRef, useState } from "react";

export default function ReaderLayout() {
  useFontEvents();
  const {
    tabs,
    activeTabId,
    isHomeActive,

    removeTab,
    activateTab,
    navigateToHome,
    getReaderStore,
    isChatVisible,
    isNotepadVisible,
  } = useLayoutStore();
  const { isDarkMode, swapSidebars } = useThemeStore();
  const { isSettingsDialogOpen, toggleSettingsDialog } = useAppSettingsStore();

  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  const isWindows = getOSPlatform() === "windows";
  const isPortrait = viewportSize.height > viewportSize.width;
  const isCompactReaderLayout = viewportSize.width < 900 && isPortrait;
  const chatDefaultWidth = isCompactReaderLayout ? Math.max(150, Math.floor(viewportSize.width * 0.42)) : 370;
  const chatMinWidth = isCompactReaderLayout ? 140 : 190;
  const chatMaxWidth = isCompactReaderLayout ? Math.max(180, Math.floor(viewportSize.width * 0.55)) : 580;
  const notepadDefaultWidth = isCompactReaderLayout ? Math.max(150, Math.floor(viewportSize.width * 0.4)) : 300;
  const notepadMinWidth = isCompactReaderLayout ? 140 : 200;
  const notepadMaxWidth = isCompactReaderLayout ? Math.max(180, Math.floor(viewportSize.width * 0.5)) : 500;
  const allowSidebarResize = true;

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setShowOverlay(true);

      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        setShowOverlay(false);
      }, 200);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCloseShortcut =
        (event.metaKey && event.key === "w" && event.code === "KeyW") ||
        (event.ctrlKey && event.key === "w" && event.code === "KeyW");

      if (isCloseShortcut) {
        event.preventDefault();
        if (activeTabId && activeTabId !== "home") {
          removeTab(activeTabId);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTabId, removeTab]);

  return (
    <div className="flex h-screen flex-col bg-muted">
      <div className="select-none border-neutral-200 dark:border-neutral-700 dark:bg-tab-background">
        <Tabs
          tabs={tabs}
          onTabActive={activateTab}
          onTabClose={removeTab}
          onTabReorder={() => {}}
          draggable={true}
          darkMode={isDarkMode}
          className="h-7"
          enableDragRegion={true}
          marginLeft={isWindows ? 0 : 60}
          pinnedLeft={
            <div className="mx-2 flex items-center gap-2" onClick={navigateToHome}>
              <HomeIcon className="size-5 text-neutral-700 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200" />
            </div>
          }
          pinnedRight={
            <div className="flex items-center gap-1">
              <NotificationDropdown />
              <WindowControls />
            </div>
          }
        />
      </div>

      <main className="relative flex-1 overflow-hidden rounded-md">
        <div
          className="absolute inset-0"
          style={{
            visibility: isHomeActive ? "visible" : "hidden",
            zIndex: isHomeActive ? 1 : 0,
          }}
        >
          <HomeLayout />
        </div>

        {tabs.map((tab) => {
          const store = getReaderStore(tab.id);
          if (!store) return null;

          const notepadSidebar = isNotepadVisible && (
            <Resizable
              defaultSize={{
                width: notepadDefaultWidth,
                height: "100%",
              }}
              minWidth={notepadMinWidth}
              maxWidth={notepadMaxWidth}
              enable={{
                top: false,
                right: allowSidebarResize && !swapSidebars,
                bottom: false,
                left: allowSidebarResize && swapSidebars,
                topRight: false,
                bottomRight: false,
                bottomLeft: false,
                topLeft: false,
              }}
              handleComponent={
                swapSidebars
                  ? {
                      left: allowSidebarResize ? <div className="custom-resize-handle" /> : undefined,
                    }
                  : {
                      right: allowSidebarResize ? <div className="custom-resize-handle custom-resize-handle-left" /> : undefined,
                    }
              }
              className="h-full"
              onResize={() => {
                if (!showOverlay) {
                  setShowOverlay(true);
                }
              }}
              onResizeStop={() => {
                setShowOverlay(false);
                window.dispatchEvent(
                  new CustomEvent("foliate-resize-update", {
                    detail: { bookId: tab.bookId, source: "resize-drag" },
                  }),
                );
              }}
            >
              <div className={swapSidebars ? "ml-1 h-[calc(100dvh-48px)]" : "mr-1 h-[calc(100dvh-48px)]"}>
                <NotepadContainer bookId={tab.bookId} />
              </div>
            </Resizable>
          );

          const chatSidebar = isChatVisible && (
            <Resizable
              defaultSize={{
                width: chatDefaultWidth,
                height: "100%",
              }}
              minWidth={chatMinWidth}
              maxWidth={chatMaxWidth}
              enable={{
                top: false,
                right: allowSidebarResize && swapSidebars,
                bottom: false,
                left: allowSidebarResize && !swapSidebars,
                topRight: false,
                bottomRight: false,
                bottomLeft: false,
                topLeft: false,
              }}
              handleComponent={
                swapSidebars
                  ? {
                      right: allowSidebarResize ? <div className="custom-resize-handle custom-resize-handle-left" /> : undefined,
                    }
                  : {
                      left: allowSidebarResize ? <div className="custom-resize-handle" /> : undefined,
                    }
              }
              className="h-full"
              onResize={() => {
                if (!showOverlay) {
                  setShowOverlay(true);
                }
              }}
              onResizeStop={() => {
                setShowOverlay(false);
                window.dispatchEvent(
                  new CustomEvent("foliate-resize-update", {
                    detail: { bookId: tab.bookId, source: "resize-drag" },
                  }),
                );
              }}
            >
              <div
                className={
                  swapSidebars ? "mr-1 h-[calc(100dvh-48px)] rounded-md" : "m-1 mt-0 h-[calc(100dvh-48px)] rounded-md"
                }
              >
                <SideChat key={`chat-${tab.id}`} bookId={tab.bookId} />
              </div>
            </Resizable>
          );

          return (
            <ReaderProvider store={store} key={tab.id}>
              <div
                className="absolute inset-0 flex bg-background p-1"
                style={{
                  visibility: tab.id === activeTabId ? "visible" : "hidden",
                  zIndex: tab.id === activeTabId ? 1 : 0,
                }}
              >
                {swapSidebars ? chatSidebar : notepadSidebar}

                <div className="relative min-w-0 flex-1 rounded-md border shadow-around">
                  <ReaderViewer />

                  {showOverlay && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-md bg-background/80 backdrop-blur-sm dark:bg-neutral-900/60" />
                  )}
                </div>

                {swapSidebars ? notepadSidebar : chatSidebar}
              </div>
            </ReaderProvider>
          );
        })}
      </main>

      <SettingsDialog open={isSettingsDialogOpen} onOpenChange={toggleSettingsDialog} />
    </div>
  );
}
