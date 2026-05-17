# Codebase Cleanup Audit

## Summary

The app root is Android mobile/tablet first, but several non-Android or legacy surfaces remain. The largest issue is not only a UI tab: Llama.cpp is wired through TypeScript settings/state, prompt/tool enablement, Rust commands, Tauri plugin registration, Cargo dependencies, permissions, and backup config scope.

## Android Baseline

* `packages/app/src/main.tsx` mounts `AndroidAppShell` directly.
* `packages/app/src/mobile/app-shell.tsx` is the active root and opens shared `SettingsDialog`.
* `.trellis/spec/app/frontend/android-mobile-shell.md` states the current destinations are Library, Notes, AI, and Stats, with settings access for general, providers, models, TTS, and vector model settings.
* `.trellis/spec/app/frontend/directory-structure.md` explicitly says `src/App.tsx` is a Vite starter stub and must not be treated as the app shell.

## Llama / Local Backend Surface

Frontend:

* `packages/app/src/components/settings/llama.tsx` combines remote vector model settings with local Llama.cpp server/model controls.
* `packages/app/src/components/settings/llama-client.ts` invokes `plugin:llamacpp|*` commands and calls local `llama-server`.
* `packages/app/src/store/llama-store.ts` persists under `llama-store` and mixes generic remote vector model config with local Llama session/model/download state.
* `packages/app/src/services/model-service.ts` wraps local model download/list/delete commands.
* `packages/app/src/mobile/app-shell.tsx`, `packages/app/src/constants/prompt.ts`, and `packages/app/src/ai/custom-chat-transport.ts` use `useLlamaStore` to decide whether RAG tools should be enabled.
* `packages/app/src/utils/model.ts` returns either external embeddings config or local `http://127.0.0.1:<port>/v1/embeddings` fallback.
* `packages/app/src/components/settings/settings-navigation.ts` exposes the settings key `"llama"` with label `"向量模型"`.
* `packages/app/src/components/settings/settings-navigation.test.ts` currently expects `["general", "llama", "tts", "model-providers"]`.

Backend:

* `packages/app/src-tauri/src/lib.rs` imports Llama commands, registers `.plugin(tauri_plugin_llamacpp::init())`, registers Llama commands, and cleans up Llama processes on close.
* `packages/app/src-tauri/src/core/mod.rs` exposes `pub mod llama`.
* `packages/app/src-tauri/src/core/llama/**` contains app-level local Llama path/download/model commands.
* `packages/app/src-tauri/plugins/tauri-plugin-llamacpp/**` is a local plugin for starting/stopping local `llama-server`.
* `packages/app/src-tauri/Cargo.toml` depends on `tauri-plugin-llamacpp`.
* `packages/app/src-tauri/capabilities/default.json` includes `llamacpp:default`; `capabilities/mobile.json` does not.

Backup/spec:

* `packages/app/src-tauri/src/core/backup/mod.rs` backs up `config/llama-store.json`.
* `.trellis/spec/app/frontend/data-backup.md` documents `config/llama-store.json` and excluding local Llama model/backend artifacts.

## Android-Relevant Vector/RAG Surface

* `packages/app/src/pages/library/components/book-item.tsx` exposes book vectorization from the Android library action drawer.
* `packages/app/src/pages/library/components/embedding-dialog.tsx` is a user-reachable test/debug dialog for vector search/context/chapter/range retrieval.
* `packages/app/src/ai/tools/rag-search.ts` uses `getCurrentVectorModelConfig()` and Tauri `plugin:epub|search_db`.
* `packages/app/src-tauri/plugins/tauri-plugin-epub/src/commands.rs` accepts `embeddings_url`, `model`, and `api_key`; it does not require Llama.cpp specifically.
* RAG can remain Android-relevant if it uses external embedding endpoints only.

## Other Legacy / Cleanup Candidates

* `packages/app/src/App.tsx` is the unused Vite starter app.
* `packages/app/src/App.css` is only imported by `App.tsx`.
* `packages/app/src/assets/react.svg` is only imported by `App.tsx`.
* `packages/app/public/vite.svg` is only used by `App.tsx` and the `index.html` favicon.
* `packages/app/index.html` still has Vite title/favicon: `Tauri + React + Typescript` and `/vite.svg`.
* `packages/app/src/pages/library/components/book-action-drawer.tsx` exposes `向量化测试`, which opens `EmbeddingDialog`; this appears test/debug oriented rather than a polished Android product workflow.
* `packages/app/src/pages/library/components/book-item.tsx` has a mark read/unread action that only logs and shows a toast; it is user-facing placeholder behavior, but not directly non-Android.

## Feasible Cleanup Approaches

### Approach A: Remove Local Llama.cpp, Preserve Generic Remote Vector/RAG (Recommended)

Remove the local `llama-server` backend, local GGUF model download/management UI, plugin registration, Rust Llama commands, Cargo dependency, desktop permission, and cleanup hook. Keep Android RAG/vectorization by using only external embeddings config under a generic vector store/settings surface. Rename `llama-store` and `"llama"` settings key where practical, with migration/backup updates.

Pros:

* Aligns with Android direction while preserving AI/RAG features already wired into Android.
* Removes the biggest non-Android backend and dependency surface.
* Avoids disabling book vectorization and AI citations entirely.

Cons:

* Requires careful state rename/migration and spec updates.
* More edits than simply deleting the visible Llama settings page.

### Approach B: Remove All Vector/RAG/Embedding Features

Delete Llama store/settings, remote vector model manager, book vectorization actions, RAG tools, vector DB workflows, and Llama backend.

Pros:

* Maximum cleanup and simplest mental model.
* Removes all embedding-related configuration and generated artifact concerns.

Cons:

* Removes Android AI/RAG behavior that appears intentionally supported by the current app.
* Larger behavioral change and more likely to need UX/product confirmation.

### Approach C: Minimal Llama Deletion Only

Remove the local backend/plugin and Llama.cpp server controls, but leave store names, storage key, and settings key as-is for now.

Pros:

* Lowest implementation risk.
* Preserves existing persisted remote vector settings.

Cons:

* Leaves visible/code-level `llama` naming that conflicts with the cleanup goal.
* Likely creates follow-up cleanup work.
