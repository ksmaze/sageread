import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useThemeStore } from "@/store/theme-store";
import type { ThemeMode } from "@/styles/themes";
import { getVersion } from "@tauri-apps/api/app";
import clsx from "clsx";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { GENERAL_SETTINGS_SECTIONS } from "./general-settings-model";

export default function GeneralSettings() {
  const [appVersion, setAppVersion] = useState("0.1.0");

  const { themeMode, autoScroll, setThemeMode, setAutoScroll } = useThemeStore();

  const themeModeOptions = [
    { value: "auto" as ThemeMode, label: "系统" },
    { value: "light" as ThemeMode, label: "亮色" },
    { value: "dark" as ThemeMode, label: "暗色" },
  ];

  useEffect(() => {
    getVersion().then(setAppVersion).catch(console.error);
  }, []);

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const getCurrentThemeModeLabel = () => {
    return themeModeOptions.find((option) => option.value === themeMode)?.label || "系统";
  };

  return (
    <div className="space-y-8 p-4 pt-3">
      {GENERAL_SETTINGS_SECTIONS.map((section) => (
        <section key={section.id} className="rounded-lg bg-muted/80 p-4">
          <h2 className="mb-4 text dark:text-neutral-200">{section.title}</h2>

          <div className="space-y-4">
            {section.items.map((item) => {
              switch (item.id) {
                case "app-version":
                  return (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="text dark:text-neutral-200">{item.label}</span>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">v{appVersion}</p>
                    </div>
                  );
                case "theme-mode":
                  return (
                    <div key={item.id} className="flex items-start justify-between">
                      <div>
                        <span className="text dark:text-neutral-200">{item.label}</span>
                        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">{item.description}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="w-32 justify-between">
                            {getCurrentThemeModeLabel()}
                            <ChevronDownIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          {themeModeOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              onClick={() => handleThemeModeChange(option.value)}
                              className={clsx("my-0.5", themeMode === option.value ? "bg-accent" : "")}
                            >
                              {option.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                case "auto-scroll":
                  return (
                    <div key={item.id} className="flex items-center justify-between">
                      <div>
                        <span className="text dark:text-neutral-200">{item.label}</span>
                        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">{item.description}</p>
                      </div>
                      <Checkbox
                        checked={autoScroll}
                        onCheckedChange={(checked) => setAutoScroll(checked === true)}
                        className="data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                      />
                    </div>
                  );
              }
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
