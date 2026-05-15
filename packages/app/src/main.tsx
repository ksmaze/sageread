import { Toaster } from "@/components/ui/sonner";
import { invoke } from "@tauri-apps/api/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import { flushAllWrites } from "./lib/tauri-storage.ts";
import AndroidAppShell from "./mobile/app-shell.tsx";
import { mountFontsToMainApp } from "./utils/font.ts";

const queryClient = new QueryClient();

import "./index.css";

mountFontsToMainApp();

window.addEventListener("beforeunload", () => {
  flushAllWrites().catch((error) => {
    console.error("Failed to flush writes on app close:", error);
  });
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <AndroidAppShell />
    </HashRouter>
    <Toaster position="top-center" />
  </QueryClientProvider>,
);

// Signal to Rust that frontend is rendered and ready to show
invoke("app_ready").catch((err) => {
  console.error("Failed to signal app ready:", err);
});
