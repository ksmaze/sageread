import path from "node:path";
import { cp } from "node:fs/promises";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const host = process.env.TAURI_DEV_HOST;
const foliatePdfjsVendorDir = path.resolve(__dirname, "../foliate-js/vendor/pdfjs");

function copyFoliatePdfjsAssets(): Plugin {
  return {
    name: "sageread:copy-foliate-pdfjs-assets",
    apply: "build",
    async writeBundle(options) {
      const outputDir = path.resolve(__dirname, options.dir ?? "dist");
      await cp(foliatePdfjsVendorDir, path.join(outputDir, "assets", "vendor", "pdfjs"), {
        recursive: true,
        force: true,
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), copyFoliatePdfjsAssets()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@pdfjs": path.resolve(__dirname, "./public/vendor/pdfjs"),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
