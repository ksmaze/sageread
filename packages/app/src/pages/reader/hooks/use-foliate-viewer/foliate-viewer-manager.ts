import { type BookDoc, getDirection } from "@/lib/document";
import { transformContent } from "@/services/transform-service";
import type { BookConfig, ViewSettings } from "@/types/book";
import { type FoliateView, wrappedFoliateView } from "@/types/view";
import { getBookDirFromLanguage, getBookDirFromWritingMode } from "@/utils/book";
import { mountAdditionalFonts } from "@/utils/font";
import { manageSyntaxHighlighting } from "@/utils/highlightjs";
import { isCJKLang } from "@/utils/lang";
import {
  describeReaderNavigationError,
  describeReaderNavigationResult,
  describeReaderNavigationTarget,
  readerNavigationError,
  readerNavigationInfo,
  readerNavigationWarn,
} from "@/utils/reader-navigation-debug";
import { getDirFromUILanguage } from "@/utils/rtl";
import { applyFixedlayoutStyles, applyImageStyle, applyTranslationStyle, transformStylesheet } from "@/utils/style";
import {
  handleClick,
  handleKeydown,
  handleMousedown,
  handleMouseMove,
  handleMouseup,
  handleTouchEnd,
  handleTouchMove,
  handleTouchStart,
  handleWheel,
} from "../../utils/iframeEventHandlers";
import { EventManager } from "./event-manager";
import { type LayoutDimensions, StyleManager } from "./style-manager";

export interface FoliateViewerManagerConfig {
  bookId: string;
  bookDoc: BookDoc;
  config: BookConfig;
  insets: { top: number; right: number; bottom: number; left: number };
  container: HTMLElement;
  globalViewSettings: ViewSettings;
  onViewCreated?: (view: FoliateView) => void;
}

export interface ProgressData {
  location: string;
  sectionHref: string;
  sectionLabel: string;
  sectionId: number;
  section: number;
  pageinfo: any;
  timeinfo: any;
  range: any;
}

export class FoliateViewerManager {
  private view: FoliateView | null = null;
  private eventManager: EventManager;
  private styleManager: StyleManager | null = null;
  private isInitialized = false;
  private isDestroyed = false;
  private config: FoliateViewerManagerConfig;
  private onProgressUpdate?: (progress: ProgressData, bookId: string) => void;
  private onViewSettingsUpdate?: (settings: ViewSettings) => void;

  constructor(config: FoliateViewerManagerConfig) {
    this.config = config;
    this.eventManager = new EventManager();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized || this.isDestroyed) {
      throw new Error("Manager already initialized or destroyed");
    }

    try {
      readerNavigationInfo("foliate-manager.initialize.start", {
        bookId: this.config.bookId,
        hasInitialLocation: Boolean(this.config.config.location),
        initialLocation: describeReaderNavigationTarget({ cfi: this.config.config.location }),
        renditionLayout: this.config.bookDoc.rendition?.layout,
      });
      await this.createFoliateView();
      await this.setupEventHandlers();
      await this.openBook();
      await this.initializeStyles();
      await this.navigateToInitialPosition();

      this.isInitialized = true;
      readerNavigationInfo("foliate-manager.initialize.success", {
        bookId: this.config.bookId,
      });
    } catch (error) {
      console.error("[FoliateViewerManager] Initialization failed:", error);
      readerNavigationError("foliate-manager.initialize.error", {
        bookId: this.config.bookId,
        error: describeReaderNavigationError(error),
      });
      throw error;
    }
  }

  private async createFoliateView(): Promise<void> {
    await import("foliate-js/view.js");
    const view = wrappedFoliateView(document.createElement("foliate-view") as FoliateView);
    view.id = `foliate-view-${this.config.bookId}`;

    // Only add to container, not to document.body
    this.config.container.appendChild(view);

    this.view = view;
    this.eventManager = new EventManager(view);
    readerNavigationInfo("foliate-manager.view-created", {
      bookId: this.config.bookId,
      viewId: view.id,
    });

    // Notify that view is created and ready for use
    if (this.config.onViewCreated) {
      this.config.onViewCreated(view);
    }
  }

  private async setupEventHandlers(): Promise<void> {
    if (!this.view) return;

    this.eventManager.setupFoliateEventHandlers({
      onLoad: this.handleLoad.bind(this),
      onRelocate: this.handleRelocate.bind(this),
      onRendererRelocate: this.handleRendererRelocate.bind(this),
    });

    this.eventManager.setupGlobalEventListeners(this.config.bookId, {
      onResize: this.handleResize.bind(this),
      onMessage: this.handleMessage.bind(this),
    });
  }

  private async openBook(): Promise<void> {
    if (!this.view) return;

    const { bookDoc, globalViewSettings } = this.config;
    readerNavigationInfo("foliate-manager.open-book.start", {
      bookId: this.config.bookId,
      renditionLayout: bookDoc.rendition?.layout,
      title: bookDoc.metadata?.title,
    });

    // Set writing mode and direction
    const writingMode = globalViewSettings.writingMode;
    if (writingMode) {
      const settingsDir = getBookDirFromWritingMode(writingMode);
      const language = Array.isArray(bookDoc.metadata.language)
        ? bookDoc.metadata.language[0]
        : bookDoc.metadata.language;
      const languageDir = getBookDirFromLanguage(language);
      if (settingsDir !== "auto") bookDoc.dir = settingsDir;
      else if (languageDir !== "auto") bookDoc.dir = languageDir;
    }

    await this.view.open(bookDoc);
    readerNavigationInfo("foliate-manager.open-book.success", {
      bookId: this.config.bookId,
      renditionLayout: bookDoc.rendition?.layout,
    });

    // Setup transform handlers
    const { book } = this.view;
    const dimensions = this.getContainerDimensions();

    book.transformTarget?.addEventListener("load", (event: Event) => {
      const { detail } = event as CustomEvent;
      if (detail.isScript) detail.allowScript = globalViewSettings.allowScript ?? false;
    });

    book.transformTarget?.addEventListener("data", this.getDocTransformHandler(dimensions));
  }

  private async initializeStyles(): Promise<void> {
    if (!this.view) return;

    const { globalViewSettings } = this.config;
    this.styleManager = new StyleManager(this.view, globalViewSettings);

    const dimensions = this.getContainerDimensions();
    this.styleManager.updateLayout(dimensions);
    this.styleManager.applyStyles();

    applyTranslationStyle(globalViewSettings);
  }

  private async navigateToInitialPosition(): Promise<void> {
    if (!this.view) return;

    const { config } = this.config;
    if (config.location) {
      const target = describeReaderNavigationTarget({
        bookId: this.config.bookId,
        cfi: config.location,
        source: "initial-location",
      });
      readerNavigationInfo("foliate-manager.initial-position.init.start", {
        bookId: this.config.bookId,
        target,
      });
      try {
        await this.view.init({ lastLocation: config.location });
        readerNavigationInfo("foliate-manager.initial-position.init.success", {
          bookId: this.config.bookId,
          target,
        });
        return;
      } catch (error) {
        console.warn("[FoliateViewerManager] Failed to restore initial location, falling back to start:", error);
        readerNavigationWarn("foliate-manager.initial-position.init.error-fallback", {
          bookId: this.config.bookId,
          error: describeReaderNavigationError(error),
          target,
        });
      }
    }

    readerNavigationInfo("foliate-manager.initial-position.fraction-start.start", {
      bookId: this.config.bookId,
    });
    const result = await this.view.goToFraction(0);
    readerNavigationInfo("foliate-manager.initial-position.fraction-start.success", {
      bookId: this.config.bookId,
      result: describeReaderNavigationResult(result),
    });
  }

  private handleLoad(event: CustomEvent): void {
    const { doc } = event.detail;
    if (!doc) return;

    const writingDir = this.view?.renderer.setStyles && getDirection(doc);
    const { bookDoc, globalViewSettings } = this.config;

    // Update view settings based on document
    const updatedSettings = {
      ...globalViewSettings,
      vertical: writingDir?.vertical || globalViewSettings.writingMode?.includes("vertical") || false,
      rtl:
        writingDir?.rtl || getDirFromUILanguage() === "rtl" || globalViewSettings.writingMode?.includes("rl") || false,
    };

    this.onViewSettingsUpdate?.(updatedSettings);

    // Apply document-specific styles
    const language = Array.isArray(bookDoc.metadata.language)
      ? bookDoc.metadata.language[0]
      : bookDoc.metadata.language;

    mountAdditionalFonts(doc, isCJKLang(language)).catch((error) => {
      console.error("[FoliateViewer] Failed to mount fonts:", error);
    });

    if (bookDoc.rendition?.layout === "pre-paginated") {
      applyFixedlayoutStyles(doc, updatedSettings);
    }

    applyImageStyle(doc);

    if (updatedSettings.codeHighlighting) {
      manageSyntaxHighlighting(doc, updatedSettings);
    }

    // Set up iframe event listeners if not already added
    if (!doc.isEventListenersAdded) {
      doc.isEventListenersAdded = true;
      const bookId = this.config.bookId;
      doc.addEventListener("click", (event: MouseEvent) => handleClick(bookId, event));
      doc.addEventListener("mousedown", (event: MouseEvent) => handleMousedown(bookId, event));
      doc.addEventListener("mouseup", (event: MouseEvent) => handleMouseup(bookId, event));
      doc.addEventListener("mousemove", (event: MouseEvent) => handleMouseMove(bookId, event));
      doc.addEventListener("wheel", (event: WheelEvent) => handleWheel(bookId, event));
      doc.addEventListener("keydown", (event: KeyboardEvent) => handleKeydown(bookId, event));
      doc.addEventListener("touchstart", (event: TouchEvent) => handleTouchStart(bookId, event), { passive: true });
      doc.addEventListener("touchmove", (event: TouchEvent) => handleTouchMove(bookId, event), { passive: true });
      doc.addEventListener("touchend", (event: TouchEvent) => handleTouchEnd(bookId, event), { passive: true });
    }
  }

  private handleRelocate(event: CustomEvent): void {
    const detail = event.detail;
    readerNavigationInfo("foliate-manager.relocate", {
      bookId: this.config.bookId,
      hasRange: Boolean(detail.range),
      location: detail.cfi,
      pageinfo: detail.location,
      section: detail.section,
      tocHref: detail.tocItem?.href,
      tocLabel: detail.tocItem?.label,
    });
    this.onProgressUpdate?.(
      {
        location: detail.cfi,
        sectionHref: detail.tocItem?.href || "",
        sectionLabel: detail.tocItem?.label || "",
        sectionId: detail.tocItem?.id ?? 0,
        section: detail.section,
        pageinfo: detail.location,
        timeinfo: detail.time,
        range: detail.range,
      },
      this.config.bookId,
    );
  }

  private handleRendererRelocate(event: CustomEvent): void {
    const detail = event.detail;
    if (detail.reason !== "scroll" && detail.reason !== "page") return;
  }

  private handleResize(_bookIds: string[]): void {
    if (this.styleManager) {
      const dimensions = this.getContainerDimensions();
      this.styleManager.updateLayout(dimensions);
    }
    this.checkLayoutStability();
  }

  private checkLayoutStability(): void {
    const foliateView = document.getElementById(`foliate-view-${this.config.bookId}`);
    if (!foliateView) {
      this.dispatchStableEvent();
      return;
    }

    let frameCount = 0;
    let lastLayout: { scrollWidth: number; scrollHeight: number; childCount: number } | null = null;
    let stableFrames = 0;

    const checkFrame = () => {
      frameCount++;

      const currentLayout = {
        scrollWidth: foliateView.scrollWidth,
        scrollHeight: foliateView.scrollHeight,
        childCount: foliateView.children.length,
      };

      if (lastLayout) {
        const isStable =
          currentLayout.scrollWidth === lastLayout.scrollWidth &&
          currentLayout.scrollHeight === lastLayout.scrollHeight &&
          currentLayout.childCount === lastLayout.childCount;

        if (isStable) {
          stableFrames++;

          if (stableFrames >= 5) {
            setTimeout(() => this.dispatchStableEvent(), 150);
            return;
          }
        } else {
          stableFrames = 0;
        }
      }

      lastLayout = currentLayout;

      if (frameCount < 15) {
        requestAnimationFrame(checkFrame);
      } else {
        setTimeout(() => this.dispatchStableEvent(), 100);
      }
    };

    setTimeout(() => requestAnimationFrame(checkFrame), 150);
  }

  private dispatchStableEvent(): void {
    window.dispatchEvent(
      new CustomEvent("foliate-layout-stable", {
        detail: { bookIds: [this.config.bookId] },
      }),
    );
  }

  private handleMessage(event: MessageEvent): void {
    if (event?.data?.type === "iframe-single-click" && event?.data?.bookId === this.config.bookId) {
      try {
        this.view?.clearSearch?.();
      } catch (e) {
        console.warn("Failed to clear search on single click:", e);
      }
    }
  }

  private getDocTransformHandler(dimensions: LayoutDimensions) {
    return (event: Event) => {
      const { detail } = event as CustomEvent;
      detail.data = Promise.resolve(detail.data)
        .then((data) => {
          if (detail.type === "text/css") return transformStylesheet(dimensions.width, dimensions.height, data);
          if (detail.type === "application/xhtml+xml") {
            const ctx = {
              bookId: this.config.bookId,
              viewSettings: this.config.globalViewSettings,
              content: data,
              transformers: ["punctuation", "footnote"],
            };
            return Promise.resolve(transformContent(ctx));
          }
          return data;
        })
        .catch((e) => {
          console.error(new Error(`Failed to load ${detail.name}`, { cause: e }));
          return "";
        });
    };
  }

  private getContainerDimensions(): LayoutDimensions {
    const { container, insets } = this.config;
    const rect = container.getBoundingClientRect();
    return {
      width: rect.width - insets.left - insets.right,
      height: rect.height - insets.top - insets.bottom,
    };
  }

  // Public API methods
  updateViewSettings(settings: Partial<ViewSettings>): void {
    if (this.styleManager) {
      this.styleManager.updateSettings(settings);
    }
  }

  updateTheme(): void {
    if (this.styleManager) {
      this.styleManager.updateTheme();
    }
  }

  updateInsets(insets: { top: number; right: number; bottom: number; left: number }): void {
    this.config.insets = insets;
    if (this.styleManager) {
      const dimensions = this.getContainerDimensions();
      this.styleManager.updateLayout(dimensions);
    }
  }

  getView(): FoliateView | null {
    return this.view;
  }

  setProgressCallback(callback: (progress: ProgressData, bookId: string) => void): void {
    this.onProgressUpdate = callback;
  }

  setViewSettingsCallback(callback: (settings: ViewSettings) => void): void {
    this.onViewSettingsUpdate = callback;
  }

  async refresh(): Promise<void> {
    if (this.styleManager) {
      const dimensions = this.getContainerDimensions();
      this.styleManager.updateLayout(dimensions);
      this.styleManager.applyStyles();
    }
    this.checkLayoutStability();
  }

  destroy(): void {
    if (this.isDestroyed) return;

    try {
      // Clean up style manager
      if (this.styleManager) {
        this.styleManager.dispose();
        this.styleManager = null;
      }

      // Clean up event manager
      this.eventManager.destroy();

      // Clean up view
      if (this.view) {
        try {
          if (this.view.close) this.view.close();
          if (this.view.remove) this.view.remove();
        } catch (error) {
          console.warn("Error during view cleanup:", error);
        }
        this.view = null;
      }

      this.isDestroyed = true;
      this.isInitialized = false;
    } catch (error) {
      console.error("Error destroying FoliateViewerManager:", error);
    }
  }
}
