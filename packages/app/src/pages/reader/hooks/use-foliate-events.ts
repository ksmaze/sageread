import { useEffect, useRef } from "react";
import type { FoliateView } from "@/types/view";

type FoliateEventHandler = {
  onLoad?: (event: Event) => void;
  onRelocate?: (event: Event) => void;
  onLinkClick?: (event: Event) => void;
  onRendererRelocate?: (event: Event) => void;
  onDrawAnnotation?: (event: Event) => void;
  onShowAnnotation?: (event: Event) => void;
};

export const useFoliateEvents = (view: FoliateView | null, handlers?: FoliateEventHandler) => {
  const handlersRef = useRef<FoliateEventHandler | undefined>(handlers);
  handlersRef.current = handlers;
  const hasOnLoad = Boolean(handlers?.onLoad);
  const hasOnRelocate = Boolean(handlers?.onRelocate);
  const hasOnLinkClick = Boolean(handlers?.onLinkClick);
  const hasOnRendererRelocate = Boolean(handlers?.onRendererRelocate);
  const hasOnDrawAnnotation = Boolean(handlers?.onDrawAnnotation);
  const hasOnShowAnnotation = Boolean(handlers?.onShowAnnotation);

  useEffect(() => {
    if (!view) return;
    const onLoad = (event: Event) => handlersRef.current?.onLoad?.(event);
    const onRelocate = (event: Event) => handlersRef.current?.onRelocate?.(event);
    const onLinkClick = (event: Event) => handlersRef.current?.onLinkClick?.(event);
    const onRendererRelocate = (event: Event) => handlersRef.current?.onRendererRelocate?.(event);
    const onDrawAnnotation = (event: Event) => handlersRef.current?.onDrawAnnotation?.(event);
    const onShowAnnotation = (event: Event) => handlersRef.current?.onShowAnnotation?.(event);

    if (hasOnLoad) view.addEventListener("load", onLoad);
    if (hasOnRelocate) view.addEventListener("relocate", onRelocate);
    if (hasOnLinkClick) view.addEventListener("link", onLinkClick);
    if (hasOnRendererRelocate) view.renderer?.addEventListener("relocate", onRendererRelocate);
    if (hasOnDrawAnnotation) view.addEventListener("draw-annotation", onDrawAnnotation);
    if (hasOnShowAnnotation) view.addEventListener("show-annotation", onShowAnnotation);

    return () => {
      if (hasOnLoad) view.removeEventListener("load", onLoad);
      if (hasOnRelocate) view.removeEventListener("relocate", onRelocate);
      if (hasOnLinkClick) view.removeEventListener("link", onLinkClick);
      if (hasOnRendererRelocate) view.renderer?.removeEventListener("relocate", onRendererRelocate);
      if (hasOnDrawAnnotation) view.removeEventListener("draw-annotation", onDrawAnnotation);
      if (hasOnShowAnnotation) view.removeEventListener("show-annotation", onShowAnnotation);
    };
  }, [view, hasOnLoad, hasOnRelocate, hasOnLinkClick, hasOnRendererRelocate, hasOnDrawAnnotation, hasOnShowAnnotation]);
};
