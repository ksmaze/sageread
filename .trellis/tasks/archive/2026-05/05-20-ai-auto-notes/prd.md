# Brainstorm: AI Auto Notes

## Goal

Add an AI-assisted note creation flow that can turn important chat content into concise notes, using the app's existing notes feature instead of introducing a new note storage concept. The feature should fit the current AI chat experience, where summarization, references/citations, and DB-backed skills already exist.

## What I already know

* User wants AI to automatically add notes based on chat content.
* Current AI chat already supports summarization-style prompts and citation/reference display.
* User specifically asked to add a skill for automatically generating notes.
* Notes are an existing app feature and should be reused.
* The app has independent `Note` records backed by the `notes` SQLite table.
* The current AI `notes` tool only reads/query notes; it does not create notes.
* The app has a DB-backed `skills` system plus default skills in `packages/app/src-tauri/src/core/default-skills.json`.
* Active skills are injected into the system prompt as available SOPs, and the model can call `getSkills` when a matching task appears.
* The chat transport currently attaches tools including `notes`, `getBooks`, `getReadingStats`, `getSkills`, and `mindmap`.

## Assumptions (temporary)

* "Skill" means an app AI skill stored in the existing `skills` table, not a Codex/Trellis development skill.
* The MVP should create records in the existing `notes` table, not `book_notes`.
* AI-generated notes should be concise study/reading notes, not verbatim copies of full chat answers.
* AI-generated reader-selection notes should follow the existing source-bound `Note` contract: book-bound, location-aware, and source-aware when a reader CFI exists.
* AI-generated learning notes should not use RAG `chunk_id` as note position; AI should choose short verbatim source candidates, and the frontend should confirm CFI through Foliate search when possible.

## Open Questions

* None currently.

## Requirements (evolving)

* Reuse the current note model and note UI surfaces.
* Add a skill that teaches the AI how to generate concise notes from chat content.
* Support both draft-confirm and direct-save note creation paths.
* Use an AI-suggested review flow for passive/autodetected note-worthy chat content: the AI may detect note-worthy chat content and present a concise note draft.
* Support direct save when the user explicitly asks to generate/save notes, including a quick action button similar to "生成思维导图".
* "生成学习笔记" quick action should generate from recent chat history plus current chapter context, not from reader selection.
* For "生成学习笔记", the AI should choose relevant source text candidates from chat/RAG evidence so the frontend can resolve a CFI through Foliate search.
* Source CFI resolution should search within the current reader section/chapter first; this should use the actual Foliate section index from reader progress, not `chunk_id`.
* When Foliate search returns candidate matches, the results should be returned to the AI with CFI and excerpt so the AI can confirm the best match before saving.
* If section-scoped search returns multiple plausible matches, the AI may choose the best one from the returned excerpts; because the search is scoped to the current chapter, taking the first plausible match is acceptable after AI confirmation.
* The source resolver must be robust to line breaks and formatting differences by normalizing whitespace, trying shorter quote spans, and allowing multiple source candidates before giving up.
* If source text resolution still fails, the note should fall back to the current chapter start CFI rather than being saved without location.
* Chapter-start fallback should prefer the current TOC item's `cfi` found by `progress.sectionHref`; if unavailable, use Foliate's section-start CFI from the actual reader section index; if neither exists, only then omit `cfi`.
* Chapter-start fallback should not invent a selected `sourceText`; it may store the chapter label or leave `sourceText` empty while saving the synthesized note content.
* Allow direct save when the user explicitly triggers note generation or when the AI has high confidence that the answer contains durable, note-worthy learning value.
* Low-confidence or ambiguous suggestions should still use a review card instead of direct save.
* High-confidence automatic saves use a strict threshold: only durable learning content such as concept definitions, key conclusions, comparisons, methods/steps, or important book arguments should be saved automatically, and references/citations should be preserved when available.
* Directly saved notes should show a saved-note card under the relevant AI answer so the user can immediately inspect and correct the result.
* Directly saved notes should be created from the AI's generated note body, not from the raw assistant reply text.
* AI-generated notes should not preserve a direct chat/thread/message source link. Save the note content and normal note fields only.
* When AI-generated notes are produced from reader-selected text, they should be saved as source-bound notes with `bookId`, `bookMeta`, exact `cfi`, `sourceText`, and nearby context.
* When AI-generated notes are produced from chat/current chapter without a reader selection, they should be book-bound notes with `bookId`, `bookMeta`, synthesized content, and AI-selected verbatim source candidates; `cfi` should be saved from confirmed Foliate search when possible, otherwise from the current chapter start fallback.
* The AI note flow should separate source resolution from final note creation: resolve candidate source text to CFI first, let the AI confirm, then call note creation with the confirmed CFI/source text.
* AI-generated notes must not be written into `book_notes`; `book_notes` remains for highlights, bookmarks, and excerpts.
* Quick-action AI notes may be directly saved without a reader selection because their source is the current chat and current chapter.
* The note creation tool must reliably supply `bookMeta` when saving a book-bound note, either from extended `ChatContext` or a local lookup by `activeBookId`.
* Generated note content should save concise conclusions plus source references.
* The default generated note format should favor 3-5 key points and preserve citations or referenced text summaries when available.
* Do not create fake reader CFIs from `chunk_id`. Use Foliate search over verbatim source text to confirm CFI; if no confident source match is found, fall back to current chapter start CFI.
* Show the confirmation/review UI as a structured note draft card under the relevant AI answer, with actions such as save, edit, and ignore.
* Do not append confirmation prompts into the assistant's markdown answer body.
* Keep the MVP narrow: automatic draft suggestion, user review/edit, confirmed save, explicit quick-action direct save, and high-confidence automatic direct save.
* Preserve current chat summarization, citation, and reference behavior.
* Avoid duplicate note storage concepts.
* Add a chat quick action for generating notes, alongside existing quick actions such as summary and mindmap.

## Acceptance Criteria (evolving)

* [x] A default skill exists for generating concise notes from chat content.
* [x] The AI can use existing chat context and references/citations to produce note-ready content.
* [ ] When a response contains note-worthy information, the user can review a generated note draft before it is saved.
* [ ] Passive/autodetected note suggestions do not create notes until the user confirms.
* [x] Explicit note-generation actions can create notes directly through an AI note creation tool.
* [ ] High-confidence AI-detected note-worthy responses can create notes directly.
* [ ] High-confidence automatic direct saves use a strict threshold for durable, review-worthy learning content.
* [ ] Low-confidence AI-detected note suggestions remain reviewable draft cards.
* [ ] Directly saved notes show an "already saved" card under the relevant AI answer with follow-up actions.
* [x] Directly saved notes are created from the synthesized note body rather than the raw assistant reply.
* [x] AI-generated notes do not require a chat/thread/message source reference.
* [x] Reader-source AI notes preserve existing source-bound fields (`bookId`, `bookMeta`, `cfi`, `sourceText`, context) when available.
* [x] The "生成学习笔记" quick action uses recent chat history and current chapter context as its source.
* [x] The "生成学习笔记" quick action lets the AI select relevant verbatim source candidates from chat/RAG evidence.
* [x] The note creation flow can use Foliate search to resolve a confirmed CFI from source candidates when the reader view is available.
* [x] Foliate source resolution searches the current section/chapter first using the reader's actual section index.
* [x] Foliate source resolution returns candidate excerpts to the AI for confirmation before saving a CFI.
* [x] Source matching tolerates whitespace/newline differences by normalizing candidate text and trying shorter fallback spans.
* [x] When source matching fails, AI learning notes fall back to the current chapter start CFI.
* [x] Notes do not store invented CFIs; any saved CFI comes from Foliate search, current TOC/section start, or reader selection.
* [x] Book-bound AI note creation supplies valid `bookMeta` and passes existing note validation.
* [x] A "生成学习笔记" style quick action is available in chat quick actions.
* [ ] Suggested notes appear as a card under the relevant AI answer rather than as extra prose inside the answer.
* [ ] The draft card supports saving, editing before save, and dismissing/ignoring.
* [x] Generated note content contains concise takeaways plus traceable references/citations when available.
* [x] Generated notes are saved into the existing notes system.
* [x] Book-scoped chats can save book-linked notes when the active book is known.
* [x] The notes list/unified notes surfaces show AI-generated notes without a separate UI model.
* [x] Existing summary, citation, RAG, mindmap, and note-query flows keep working.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint/typecheck/build pass.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* New cloud sync behavior.
* Replacing the existing notes database or unified notes UI.
* Rich text note editing beyond current markdown/plain content behavior.
* Fully autonomous background processing unrelated to a user-visible chat response or explicit note-generation action.
* Duplicate detection beyond preventing the same visible draft card from being saved twice.
* AI-suggested tags/categories.

## Technical Notes

* Task directory: `.trellis/tasks/05-20-ai-auto-notes`.
* Relevant packages: `packages/app` frontend and Tauri core.
* Existing default skills: `packages/app/src-tauri/src/core/default-skills.json`.
* Existing skill service: `packages/app/src/services/skill-service.ts`.
* Existing AI skill lookup tool: `packages/app/src/ai/tools/get-skills.ts`.
* Existing note read tool: `packages/app/src/ai/tools/notes.ts`.
* Existing note service: `packages/app/src/services/note-service.ts`.
* Existing note type: `packages/app/src/types/note.ts`.
* Existing AI chat transport/tool wiring: `packages/app/src/ai/custom-chat-transport.ts`.
* Existing prompt builder: `packages/app/src/constants/prompt.ts`.
* Existing quick actions: `packages/app/src/components/side-chat/chat-input-area.tsx`.
* Existing independent note design: `docs/superpowers/specs/2026-05-16-independent-reader-notes-design.md`.
* Existing source-bound note contract: `.trellis/spec/app/frontend/state-management.md`.
* Existing RAG chunk anchor tools: `packages/app/src/ai/tools/rag-search.ts`, `rag-context.ts`, `rag-toc.ts`, and `rag-range.ts`.
* Existing Foliate search path: `packages/app/src/pages/reader/components/search-bar.tsx` and `packages/app/src/components/markdown/hooks/use-annotation-search.ts`.
* Foliate `search({ index })` expects a section index. The current generic search UI uses `pageinfo.current` for section search, but AI note source resolution should use reader progress `section` / actual section index.
* `BookProgress` currently stores `sectionId`, `sectionHref`, and `sectionLabel`; runtime relocate data also includes `section`. AI note positioning should expose/use that actual section index for section search and section-start fallback.

## Research References

* [`research/technical-path.md`](research/technical-path.md) — recommended path updated to a hybrid of message-metadata draft cards and explicit direct-save note tool.
* [`research/existing-notes-contract.md`](research/existing-notes-contract.md) — reader notes are existing source-bound `notes` rows with book, CFI, selected source text, and nearby context.
* [`research/quick-actions-prompt-tools.md`](research/quick-actions-prompt-tools.md) — quick actions are prompt submissions; skills are DB-backed; tools are attached in `CustomChatTransport`.
* [`research/chunk-id-positioning.md`](research/chunk-id-positioning.md) — `chunk_id` can anchor AI-selected evidence but does not currently map to reader CFI.
* [`research/foliate-search-cfi.md`](research/foliate-search-cfi.md) — Foliate search can resolve CFI from verbatim source text candidates, with strict confidence limits.

## Research Notes

### Feasible approaches here

**Approach A: Metadata draft + UI save**

* How: store structured note drafts on assistant message metadata, render a draft card, and call `createNote` only after user confirmation.
* Pros: preserves user-confirmed write boundary for passive suggestions, persists drafts with chat history, avoids model-owned database writes for autodetected cases.
* Cons: needs metadata update and save-state handling.

**Approach B: `suggestNote` tool**

* How: AI calls a structured draft tool, frontend custom-renders the tool output as a note card, user confirms save.
* Pros: strong structure and clear AI tool trace.
* Cons: more custom tool rendering and tool output may compete with answer UI.

**Approach C: `createNote` tool**

* How: expose source resolution and note creation as AI tool steps. The source resolver accepts AI-selected `sourceCandidates`, searches Foliate, and returns candidate CFI/excerpt matches. The note creation tool accepts existing note fields including `bookId`, `bookMeta`, `cfi`, `sourceText`, `contextBefore`, and `contextAfter`.
* Pros: supports low-friction note creation when the user intentionally asks for it.
* Cons: needs clear trigger rules so normal chat does not create noisy notes unexpectedly.

**Chosen hybrid direction**

* Passive/autodetected suggestions use Approach A.
* Explicit "生成学习笔记" quick action and direct user requests can use Approach C to save directly.
* Reader-source notes must preserve the existing source-bound note fields instead of becoming loose chat notes.
* Chat/current-chapter learning notes should use AI-selected source candidates as their intended anchors, write `cfi` when Foliate search confirms a reliable match, and otherwise attach to the current chapter start.
