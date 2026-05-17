export type SettingsKey =
  | "general"
  | "vector-models"
  | "tts"
  | "model-providers"
  | `provider-${string}`;

export interface SettingsNavigationItem {
  key: SettingsKey;
  label: string;
  children?: SettingsNavigationItem[];
}

export const SETTINGS_NAVIGATION_ITEMS: SettingsNavigationItem[] = [
  { key: "general", label: "常规" },
  { key: "vector-models", label: "向量模型" },
  { key: "tts", label: "语音模型" },
  { key: "model-providers", label: "模型提供商" },
];
