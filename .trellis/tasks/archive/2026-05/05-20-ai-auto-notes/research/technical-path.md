# Technical Path Research: AI Auto Notes

## Question

How should the app produce, display, and persist AI-generated note draft cards while reusing the existing chat, skills, and notes systems?

## Local Findings

* Chat messages are stored as `UIMessage[]` JSON in `threads.messages` through `createThread` and `editThread`.
* `MessageMetadata` already carries app-specific fields such as provider, token usage, reasoning times, and prompt references.
* `ChatMessages` renders assistant message parts and action controls; it is the natural place to show a note draft card under the related assistant answer.
* The AI transport can attach tools and already includes `getSkills`, `notes`, `getBooks`, `getReadingStats`, and `mindmap`.
* The existing `notes` AI tool only reads notes. There is no create-note tool.
* `createNote` already persists existing independent notes and can link them to `bookId` plus `bookMeta`. Source-bound reader notes also use `cfi`, `sourceText`, `contextBefore`, and `contextAfter`.
* The skills system can add a default skill that teaches note draft format and decision criteria.
* Existing notes surfaces already read from the shared `notes` table, so saved AI notes should appear there without a separate storage model.

## Feasible Approaches

### Approach A: Metadata Draft + UI Save

The AI produces a structured note draft after an assistant answer. The frontend stores that draft in the assistant message metadata and renders a dedicated draft card under the answer. Saving calls the existing `createNote` service only after user confirmation.

Pros:
* Keeps writes user-confirmed and frontend-owned.
* Persists the draft with the chat thread.
* Avoids giving the model direct write access to notes.
* Fits the existing `MessageMetadata` extension pattern.

Cons:
* Requires explicit parsing/generation of draft metadata after model output.
* The save state must be written back to the thread message metadata after saving.

### Approach B: Create `suggestNote` Tool

Add an AI tool that returns a structured note draft as tool output. The frontend renders the tool output as a draft card and then uses `createNote` after confirmation.

Pros:
* Strong structured output path.
* Clear tool trace in existing tool UI architecture.

Cons:
* Existing generic `Tool` renderer is aimed at collapsible execution logs, not user-facing draft cards.
* Tool output becomes part of the model stream and may visually compete with the answer unless custom-rendered.

### Approach C: Create `createNote` Tool

Expose note creation as an AI tool. For the updated requirement, this should be allowed when the user explicitly asks to generate/save notes or triggers a note quick action.

Pros:
* Minimal frontend save plumbing for explicit save flows.
* Enables a "生成学习笔记" quick action similar to the existing mindmap action.

Cons:
* Easy to accidentally cross the write boundary if prompt rules are too broad.
* Needs trigger constraints so passive chat does not create unexpected notes.

## Recommendation

Use a hybrid for MVP:

* Passive/autodetected note-worthy chat content uses Approach A: add a default "自动生成笔记" skill, store a structured draft in assistant message metadata, render a dedicated card under assistant messages, and let the user save/edit/ignore it.
* Explicit note generation uses Approach C: add source-resolution and note-creation AI tool steps, expose a "生成学习笔记" quick action, and allow direct save when the user intentionally asks for note generation. Reader-selection notes should preserve source-bound fields; quick-action learning notes should use recent chat history plus current chapter context and AI-selected source candidates.
* Do not synthesize `notes.cfi` from `chunk_id`; resolve CFI by Foliate search over verbatim source text and omit CFI when no confident match exists.
* Source resolution should return Foliate CFI/excerpt candidates to the AI for confirmation before the AI calls note creation.
* If source matching fails after normalized/shorter retries, attach the note to the current chapter start CFI.

This gives low-friction note capture for explicit actions while keeping normal chat from writing notes silently.
