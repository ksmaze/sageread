import { Toaster } from "@/components/ui/sonner";
import { invoke } from "@tauri-apps/api/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import ReaderLayout from "./components/reader-layout.tsx";
import { flushAllWrites } from "./lib/tauri-storage.ts";
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
      <ReaderLayout />
    </HashRouter>
    <Toaster position="top-center" />
  </QueryClientProvider>,
);

// Signal to Rust that frontend is rendered and ready to show
invoke("app_ready").catch((err) => {
  console.error("Failed to signal app ready:", err);
});
