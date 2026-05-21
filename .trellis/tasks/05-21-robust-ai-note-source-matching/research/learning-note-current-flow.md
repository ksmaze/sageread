# Learning Note Current Flow

## Findings

- Desktop quick action in `packages/app/src/components/side-chat/chat-input-area.tsx` sends a plain prompt: "请根据最近聊天记录和当前章节生成一条学习笔记，并保存到当前书籍笔记。"
- Mobile empty-state suggestion sends only "生成学习笔记"; it relies on the active skill/prompt to expand the behavior.
- `buildReadingPrompt` loads the active system skill from Tauri default/user skills and appends current book metadata, current section label, and semantic chat context.
- The default "生成学习笔记" skill in `packages/app/src-tauri/src/core/default-skills.json` tells the model to choose one most important knowledge point, optionally use RAG, resolve 1-3 original-text candidates, then save one note.
- `createNote` persists one note with one optional `cfi`, one optional `sourceText`, and before/after context. The existing note schema does not represent multiple anchored source passages in one note.
- `resolveNoteSource` is a locator tool. It does not decide note granularity or key passage selection; it only maps model-provided source text candidates to Foliate CFIs.
- RAG tools return `chunk_id` and chunk text, but current chat transport attaches `ragSearch`, `ragToc`, and `ragContext`; `ragRange` is exported but not attached to the transport.
- The earlier implementation improved locator robustness, but it does not change the product behavior: one generated learning note can still contain several paragraphs while being anchored to one fallback location.

## Implication

The core spec should shift from "make sourceCandidates easier to match" to "generate anchored key-passage notes." The model must first select discrete original passages, then create a note per selected passage or the data model must grow to support multiple anchors per note.

The current note schema strongly favors one note per key passage because each note already has one `cfi` and one `sourceText`.
