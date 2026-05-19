import { invoke } from "@tauri-apps/api/core";
import type { OsPlatform } from "@/types/system";
import { getOSPlatform } from "@/utils/misc";

interface ProcessTextOptions {
  platform?: OsPlatform;
  invokeCommand?: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
}

type ProcessTextResult =
  | { ok: true }
  | { ok: false; reason: "empty-selection" | "unsupported-platform" }
  | { ok: false; reason: "native-error"; message: string };

const PROCESS_TEXT_COMMAND = "process_text";

const toErrorMessage = (error: unknown) => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "无法启动系统翻译";
};

export async function processSelectedTextWithAndroid(
  selectedText: string,
  options: ProcessTextOptions = {},
): Promise<ProcessTextResult> {
  const text = selectedText.trim();
  if (!text) {
    return { ok: false, reason: "empty-selection" };
  }

  const platform = options.platform ?? getOSPlatform();
  if (platform !== "android") {
    return { ok: false, reason: "unsupported-platform" };
  }

  try {
    await (options.invokeCommand ?? invoke)(PROCESS_TEXT_COMMAND, { text });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: "native-error",
      message: toErrorMessage(error),
    };
  }
}
