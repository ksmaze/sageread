import { Anthropic, DeepSeek, Gemini, Grok, OpenAI, OpenRouter } from "@/components/icons";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useProviderStore } from "@/store/provider-store";
import { ChevronRight, Server } from "lucide-react";
import { useState } from "react";
import GeneralSettings from "./general";
import LlamaSettings from "./llama";
import ProviderDetailSettings from "./provider-detail";
import ProvidersSettings from "./providers";
import { SETTINGS_DIALOG_CONTENT_CLASS_NAME } from "./settings-dialog-layout";
import { SETTINGS_NAVIGATION_ITEMS, type SettingsKey, type SettingsNavigationItem } from "./settings-navigation";
import TTSSettings from "./tts-settings";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProviderIcons({ providerId }: { providerId: string }): React.ReactNode {
  switch (providerId) {
    case "openai":
      return <OpenAI className="h-4 w-4" />;
    case "anthropic":
      return <Anthropic className="h-4 w-4" />;
    case "openrouter":
      return <OpenRouter className="h-4 w-4" />;
    case "gemini":
      return <Gemini className="h-4 w-4" />;
    case "grok":
      return <Grok className="h-4 w-4" />;
    case "deepseek":
      return <DeepSeek className="h-4 w-4" />;
    default:
      return <Server className="h-4 w-4" />;
  }
}

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeKey, setActiveKey] = useState<SettingsKey>("general");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(["model-providers"]));
  const { modelProviders } = useProviderStore();

  const settingsItems: SettingsNavigationItem[] = SETTINGS_NAVIGATION_ITEMS.map((item) =>
    item.key === "model-providers"
      ? {
          ...item,
          children: modelProviders.map((provider) => ({
            key: `provider-${provider.provider}` as SettingsKey,
            label: provider.name,
          })),
        }
      : item,
  );

  const getProviderStatus = (providerId: string) => {
    const provider = modelProviders.find((p) => p.provider === providerId);
    return provider?.active ?? false;
  };

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedItems(newExpanded);
  };

  const renderSettingsContent = () => {
    switch (activeKey) {
      case "general":
        return <GeneralSettings />;
      case "llama":
        return <LlamaSettings />;
      case "tts":
        return <TTSSettings />;
      case "model-providers":
        return (
          <ProvidersSettings onProviderSelect={(providerId) => setActiveKey(`provider-${providerId}` as SettingsKey)} />
        );
      default:
        if (activeKey.startsWith("provider-")) {
          const providerId = activeKey.replace("provider-", "");
          return <ProviderDetailSettings providerId={providerId} onBack={() => setActiveKey("model-providers")} />;
        }
        return <GeneralSettings />;
    }
  };

  const renderSidebarItem = (item: SettingsNavigationItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.key);
    const isActive = activeKey === item.key;

    return (
      <div key={item.key}>
        {hasChildren ? (
          <Collapsible open={isExpanded}>
            <button
              onClick={() => setActiveKey(item.key)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg p-1.5 py-1 text-left text-neutral-700 text-sm transition-colors focus:outline-0",
                level === 0 ? "" : "ml-4",
                isActive ? "bg-muted/80 dark:text-neutral-100" : "hover:bg-muted/80 dark:text-neutral-300",
              )}
            >
              <div className="flex items-center gap-2">
                {item.icon && <item.icon className="h-4 w-4" />}
                <span className="truncate text-sm">{item.label}</span>
              </div>
              <ChevronRight
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(item.key);
                }}
                className={cn("h-4 w-4 flex-shrink-0 transition-transform", isExpanded && "rotate-90")}
              />
            </button>
            <CollapsibleContent className="mt-1 space-y-1">
              {item.children?.map((child) => renderSidebarItem(child, level + 1))}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <button
            onClick={() => setActiveKey(item.key)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg p-1.5 py-1 text-left text-neutral-700 text-sm transition-colors focus:outline-0",
              level === 0 ? "" : "ml-3 w-[91%]",
              isActive ? "bg-muted/80 dark:text-neutral-100" : "hover:bg-muted/80 dark:text-neutral-300",
            )}
          >
            {item.key.startsWith("provider-") ? (
              <ProviderIcons providerId={item.key.replace("provider-", "")} />
            ) : item.icon ? (
              <item.icon className="h-4 w-4" />
            ) : null}
            <span className="truncate text-sm">{item.label}</span>
            {item.key.startsWith("provider-") && (
              <div
                className={cn(
                  "mr-1 ml-auto h-2 w-2 flex-shrink-0 rounded-full",
                  getProviderStatus(item.key.replace("provider-", "")) ? "bg-green-500" : "bg-red-500",
                )}
              />
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SETTINGS_DIALOG_CONTENT_CLASS_NAME}>
        <DialogHeader className="flex-shrink-0 border-neutral-200 border-b px-3 py-4 dark:border-neutral-800 dark:bg-neutral-900">
          <DialogTitle className="dark:text-neutral-100">设置</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row dark:bg-neutral-900">
          <div className="max-h-36 w-full flex-shrink-0 overflow-y-auto border-neutral-200 border-b p-3 px-2 sm:max-h-none sm:w-48 sm:border-r sm:border-b-0 dark:border-neutral-800 dark:bg-neutral-900">
            <nav className="space-y-1">{settingsItems.map((item) => renderSidebarItem(item))}</nav>
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto dark:bg-neutral-900">{renderSettingsContent()}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
