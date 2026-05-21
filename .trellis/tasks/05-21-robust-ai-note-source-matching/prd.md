# Brainstorm: Anchored AI Learning Notes

## Goal

Redesign "生成学习笔记" so it produces useful source-anchored study notes from the current chapter and recent chat, instead of creating one chapter-level summary note that falls back to the chapter start. The AI should extract important original passages, locate each passage in the reader, and save concise note content tied to the passage.

## What I Already Know

- User is not satisfied with the current implementation because it extracts once, combines multiple paragraphs, cannot locate them reliably, falls back to chapter start, and produces broad chapter-summary content rather than key-point notes.
- User wants AI to extract key content paragraphs, add annotations/notes, and include summary content.
- User also wants explicit annotation behavior: after discussing a concept or a specific paragraph with AI, they can ask AI to add a note/annotation for that discussed target.
- Current desktop quick action sends one generic prompt asking for "一条学习笔记"; mobile sends "生成学习笔记".
- Current selected-text "ask AI" flow sends the selected text as a chat quote, but the chat reference only contains text, not the reader selection CFI.
- Current default skill explicitly asks the model to identify one most important knowledge point and save one note.
- Existing `Note` / `CreateNoteData` supports one `cfi`, one `sourceText`, and one note body per note.
- `resolveNoteSource` is only a locator tool; it does not decide what passages are important.
- RAG tools provide chunk text and `chunk_id`, but `chunk_id` is not a note location. CFIs still need to come from the reader/Foliate side.
- Code inspection notes are in `research/learning-note-current-flow.md`.

## Assumptions To Validate

- "关键内容段落" means discrete original passages from the current chapter, not one full-chapter summary.
- The MVP should create source-bound notes that the current notes UI can already display, rather than first adding a new multi-anchor note data model.
- If a passage cannot be located confidently, it should not silently create a chapter-start source note.

## Open Questions

- None.

## Requirements (Evolving)

- The generated learning note flow must separate two phases:
  - passage extraction: choose important original passages from current chapter/chat context
  - note creation: write concise summary/explanation content for each selected passage
- Saved notes should be anchored to the passage location, not merely to the chapter start.
- The AI prompt/skill must stop asking for "一条学习笔记" when the intended behavior is passage-level extraction.
- Chapter-start fallback is allowed when passage-level CFI resolution fails, but must be represented and messaged as fallback, not as a successful original-text match.
- One click should create multiple source-bound notes: one saved note per extracted key passage.
- Each generated note should contain one source passage and one concise summary/explanation for that passage.
- The flow should report how many generated notes used exact passage matches versus chapter-start fallback.
- One quick action should generate at most 3 notes by default; fewer is acceptable when the chapter/context has fewer worthwhile key passages.
- Passage selection should prioritize recent chat topics. If the chat does not contain a clear topic, the model should choose the current chapter's highest-signal passages.
- Before selecting passages, the model must fetch real source text with RAG tools. It must not build source candidates from its own summary or from chapter titles alone.
- Source text gathering should prefer `ragSearch`/`ragContext` around the recent chat topic. If no clear topic exists or search coverage is insufficient, it may use current-section chapter content retrieval.
- MVP enforcement should use quick action prompt, default skill, and tool-description contract changes only. Do not add a dedicated batch note creation tool in this task.
- The default "生成学习笔记" skill should declare both supported entry modes: quick-action learning notes and explicit targeted annotation requests.
- For matched notes, the original passage belongs in `sourceText`; `content` should contain concise interpretation/summary only, without duplicating the source passage.
- Note content should be short and reviewable, typically 2-4 bullets or short sentences covering meaning, importance, and connection to recent chat where relevant.
- The quick action should auto-save immediately without an extra confirmation step.
- Final chat feedback should state total saved count, exact passage-match count, chapter-start fallback count, and the saved note titles/topics.
- Explicit "add annotation/note" requests are supported as a targeted mode, not only through the quick action.
- In targeted mode, the source target priority is:
  - quoted/selected text in the current or recent user message
  - a paragraph explicitly referenced in recent chat
  - a concept from recent chat, resolved to source passages via RAG
- When quoted/selected text is available, use it directly as the source candidate before doing RAG. It is already original text.
- Targeted mode should not create unrelated chapter-summary notes; it should annotate the specified concept/paragraph.

## Acceptance Criteria (Evolving)

- [x] Quick action wording/prompt no longer implies exactly one broad note.
- [x] The "生成学习笔记" skill instructs the model to select discrete original passages before writing summaries.
- [x] The "生成学习笔记" skill declares both quick-action note generation and explicit targeted annotation modes.
- [x] Generated notes are saved with passage-level `cfi` and `sourceText` when location is found.
- [x] If the locator only returns chapter-start fallback, the flow handles it explicitly rather than saving a misleading source-bound note.
- [x] One quick action auto-saves up to 3 generated notes without a confirmation prompt.
- [x] Final response reports saved count, matched count, fallback count, and saved note titles/topics.
- [x] Explicit "给这段/这个概念加批注" requests use selected/quoted text or the discussed concept as the note target.
- [x] Selected/quoted source text is used directly as a source candidate before RAG retrieval.
- [x] Existing stock default learning-note skills are safely refreshed without overwriting user-edited skills.
- [x] Tests cover the prompt/tool contract for passage-level note creation.
- [x] Lint/typecheck/build pass for touched app files.

## Research References

- [`research/learning-note-current-flow.md`](research/learning-note-current-flow.md) — current flow is spec-limited to one generated note and one source anchor.
- [`research/source-matching-inspection.md`](research/source-matching-inspection.md) — previous locator-focused analysis.

## Feasible Approaches

### Approach A: Multiple Source-Bound Notes (Recommended)

The AI extracts 2-5 key original passages, resolves each passage, and calls `createNote` once per matched passage. Each saved note has one `cfi`, one `sourceText`, and one concise summary/body. This fits the current note schema and makes each note behave like an annotation.

Trade-off: one click can create several notes, so the model needs limits and deduplication rules.

### Approach B: One Compound Note With Multiple Anchors

The AI creates one learning note containing multiple quoted passages and summaries. This would require changing the note schema/UI to support multiple source anchors per note, or it would degrade back to one visible location.

Trade-off: better for a study-sheet style output, but larger data-model and UI work.

### Approach C: Preview-Then-Save Batch

The AI proposes extracted passages and summaries first, then saves after confirmation. This improves control, but adds UX/tooling work and slows the quick action.

Trade-off: safer for noisy models, less automatic.

## Decision (ADR-lite)

**Context**: The existing note schema supports one `cfi` and one `sourceText` per note. The user wants key-passage notes, not one broad chapter summary.

**Decision**: Use Approach A. One generated key passage becomes one saved source-bound note.

**Consequences**: This avoids a note schema/UI rewrite and makes generated notes behave like current annotations. The flow needs a limit and clear handling for passages that cannot be located.

## Decision: Unresolved Passage Handling

**Context**: The current locator is not robust enough yet. The user wants to keep a fallback now, while later improving chapter/article querying and source matching until original locations are reliably found.

**Decision**: If a key passage cannot be resolved to a passage-level CFI, save the note at chapter start as a fallback, but do not fill `sourceText` or present it as a matched source annotation.

**Consequences**: The MVP remains useful even when matching fails, but the UI/chat response must make fallback visible. Future work should improve the document query and source-location pipeline so fallback becomes rare.

## Decision: Default Batch Size

**Context**: A quick action should be useful without flooding the user's notebook.

**Decision**: Generate at most 3 key-passage notes by default.

**Consequences**: The behavior is predictable and testable. The model should prefer fewer high-signal notes over filling the quota.

## Decision: Passage Selection Priority

**Context**: The quick action is intended to use both recent chat and the current chapter.

**Decision**: Prioritize recent chat topics when selecting key passages. If recent chat has no clear topic, fall back to independently important passages in the current chapter.

**Consequences**: Generated notes should feel connected to the user's current learning thread rather than acting as a generic chapter summary.

## Decision: Source Text Requirement

**Context**: The prompt currently only includes the current chapter label, not the full chapter text. The previous behavior let the model create broad summaries and then try to locate summary-like candidates, which often failed.

**Decision**: The learning-note flow must fetch real source text before selecting key passages. It should use RAG tools to retrieve relevant source chunks, then extract 1-3 original passages from those chunks before calling `resolveNoteSource`.

**Consequences**: More tool calls are expected, but source candidates should be literal original text and therefore much easier to locate. Future work can improve document query and source-location robustness further.

## Decision: MVP Enforcement Boundary

**Context**: A dedicated batch learning-note tool could make the process stricter, but it is a larger design and implementation step.

**Decision**: For this MVP, enforce the desired behavior through quick action prompt wording, the default "生成学习笔记" skill, and `resolveNoteSource` / `createNote` tool descriptions. Do not add a new batch note tool.

**Consequences**: The change stays aligned with the current chat/tool architecture. The model is still responsible for following the sequence, so prompts and tool contracts must be explicit and tests should cover the changed contract text where practical.

## Decision: Note Body Content

**Context**: Existing notes already have separate `sourceText` and `content` fields.

**Decision**: Put the original passage in `sourceText`; put only the AI's concise annotation/summary in `content`.

**Consequences**: Generated notes remain readable and avoid duplicating the same source passage in both note fields.

## Decision: Save UX

**Context**: The user prefers automatic saving because the generated note volume is small and notes can be manually filtered/edited afterward.

**Decision**: The quick action auto-saves generated notes. It does not require a preview or confirmation step.

**Consequences**: The final assistant response must be explicit: total saved count, matched count, fallback count, and a short list of saved note titles or topics.

## Decision: Targeted Annotation Mode

**Context**: The same notes database and `createNote` tool can represent an AI-generated annotation: one source location plus concise AI-written note content. Users may ask for this after discussing a concept or after sending selected text to AI.

**Decision**: Support explicit add-annotation requests as a targeted mode. If a quote/selection exists in the current or recent user message, treat that quote as the primary original source passage and resolve it directly. If the request names a concept without a quote, retrieve relevant source passages with RAG and create up to 3 targeted notes.

**Consequences**: The feature covers both quick-action generation and user-directed annotation. Current chat references do not carry selection CFI, so selected text still needs `resolveNoteSource` unless a future change passes selection CFI through the chat event.

## Decision: Skill Contract Covers Both Modes

**Context**: The current system already has a user-facing "生成学习笔记" skill that the model can retrieve with `getSkills`. Adding a new tool is out of scope for MVP.

**Decision**: Declare both flows inside the skill:

- **Quick action mode**: generate up to 3 notes from recent chat topic plus current chapter source text.
- **Targeted annotation mode**: when the user asks to annotate a discussed concept or quoted paragraph, save notes only for that target.

**Consequences**: The skill becomes the source of truth for model behavior. Quick action prompt and tool descriptions should align with it, but the two-mode behavior is specified primarily in the skill.

## Current Recommendation

Keep a hard limit of 3 notes by default. Save matched locations with `sourceText`; save unresolved passages to chapter start without `sourceText` and clearly report them as fallback.

## Out of Scope (Draft)

- Multi-anchor note schema and UI.
- PDF whole-document automatic notes.
- Full-book note generation.
- Replacing Foliate CFI with RAG `chunk_id` as the persisted note location.
- Making article/chapter text querying fully robust in this MVP; this is future follow-up work.
- A dedicated `createLearningNotes` batch tool.
- Passing selection CFI through the Ask AI chat quote event. This would be a useful follow-up to make selected-text annotations more direct.

## Definition of Done

- Tests added/updated around changed prompt/tool contracts.
- Lint/typecheck/build pass.
- Trellis spec updated if we establish a durable AI note generation contract.
- Existing uncommitted locator changes are either adapted to the chosen design or explicitly reverted only with user approval.

## Technical Notes

- Likely files:
  - `packages/app/src-tauri/src/core/default-skills.json`
  - `packages/app/src/components/side-chat/chat-input-area.tsx`
  - `packages/app/src/mobile/ai/mobile-ai-chat.tsx`
  - `packages/app/src/ai/tools/resolve-note-source.ts`
  - `packages/app/src/ai/tools/create-note.ts`
  - `packages/app/src/ai/custom-chat-transport.ts`
  - `packages/app/src/ai/note-source-resolver.ts`
  - `packages/app/src/ai/note-source-resolver.test.ts`
