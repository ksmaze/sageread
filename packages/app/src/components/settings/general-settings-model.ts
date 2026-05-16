export interface GeneralSettingsItem {
  id: "app-version" | "theme-mode" | "auto-scroll";
  label: string;
  description?: string;
}

export interface GeneralSettingsSection {
  id: "about" | "appearance";
  title: string;
  items: GeneralSettingsItem[];
}

export const GENERAL_SETTINGS_SECTIONS: GeneralSettingsSection[] = [
  {
    id: "about",
    title: "关于",
    items: [{ id: "app-version", label: "应用版本" }],
  },
  {
    id: "appearance",
    title: "外观",
    items: [
      { id: "theme-mode", label: "明暗模式", description: "选择明暗模式偏好" },
      { id: "auto-scroll", label: "自动滚动", description: "聊天时自动滚动到最新消息" },
    ],
  },
];
