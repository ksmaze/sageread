# Quick Actions, Prompt, and Tools Research

## Question

How are chat quick actions implemented, and how are prompts, skills, and AI tools managed?

## Findings

### Quick Actions

`ChatInputArea` owns the persistent quick actions shown near the chat input:

* `总结本章`
* `分析观点`
* `生成思维导图`

Each quick action is just a predefined prompt. Clicking it calls `setInput(prompt)` and then `onSubmit(prompt)` when the chat status is ready.

Reader side chat also has an empty-state `promptSuggestions` list. That list already includes `生成学习笔记`, but it is only shown before messages exist. It is not part of the persistent `ChatInputArea.quickActions`.

Mobile AI chat has its own empty-state `promptSuggestions`, and it currently does not include `生成学习笔记`.

### Prompt Assembly

`buildReadingPrompt(chatContext)` builds the system prompt from:

* the active system skill from the `skills` table
* names of all active non-system skills
* optional semantic context
* optional current section label
* optional `metadata.md` for the active book

The active non-system skills are only listed by name in the system prompt. The model must call `getSkills(task=...)` to retrieve the full skill content.

When vector capability is absent, or the active context cannot use book-wide context, the prompt removes RAG and citation sections from the system prompt.

### Default Skills

Default skills are loaded from `packages/app/src-tauri/src/core/default-skills.json`.

Important implementation detail: `initialize_default_skills()` only runs when the database is new. Adding a new default skill to the JSON is not enough for existing app databases unless the database initialization path also upserts/migrates new default skills.

### Tool Management

`CustomChatTransport` owns the available AI tools:

* always attached: `notes`, `getBooks`, `getReadingStats`, `getSkills`, `mindmap`
* conditionally attached for EPUB/book-wide context with vector capability: `ragSearch`, `ragToc`, `ragContext`

The current `notes` tool only reads notes. There is no tool that creates a note.

The mindmap path works because:

1. the UI submits the prompt "请基于当前内容生成思维导图。"
2. the system prompt advertises the active skill name "生成思维导图"
3. the model calls `getSkills`
4. the model calls `mindmap`
5. the UI renders the mindmap tool output specially

### Chat History Window

`selectValidMessages(processedMessages, 8)` limits model-visible chat history to at most 8 valid recent messages around the latest user message. A "based on chat history" note will use that same recent message window unless this selection strategy is changed.

### Current Context Passed to Chat

`ChatContext` currently includes:

* `activeBookId`
* `activeBookFormat`
* `activeContext`
* `activeSectionLabel`

It does not include:

* current book title/author as structured data
* current reader `progress.location`
* current reader range/CFI details

Because `create_note` rejects `bookId` without `bookMeta`, a robust create-note tool needs either structured book metadata in `ChatContext` or a reliable local lookup by `activeBookId`.

## Implications

`生成学习笔记` should be implemented like `生成思维导图`: a persistent quick action prompt plus a skill plus a dedicated tool.

The note tool should create notes through the existing `notes` service/table, not `book_notes`.

For the quick action described by the user, the source is recent chat history plus current chapter context, not reader selection. That means it should not depend on a selected reader range. The implementation still needs an anchoring rule for the saved note location:

* AI chooses short verbatim source candidates from chat/RAG evidence.
* A frontend source-resolution tool resolves those candidates through Foliate `view.search(...)` when a reader view is available.
* Source resolution searches the current section/chapter first and returns CFI/excerpt candidates to the AI for confirmation.
* If the AI confirms a Foliate search match, the note creation tool may save that real CFI in `notes.cfi`.
* `chunk_id` may help retrieve evidence, but it is not a note position and should not be stored as fake CFI.
* If Foliate search is unavailable, fails, or is ambiguous, quick-action learning notes should fall back to the current chapter start CFI when available.

The recommended implementation path is:

1. Add "生成学习笔记" to persistent chat quick actions and mobile suggestions.
2. Add a default active skill named "生成学习笔记" that defines note format and save rules.
3. Add a `resolveNoteSource` AI tool that accepts `sourceCandidates` and returns Foliate CFI/excerpt matches.
4. Add a `createNote` AI tool that writes through existing note service using the confirmed CFI/source text when available.
5. Extend `ChatContext` or tool lookup so `createNote` can reliably include `bookMeta` for book-bound notes.
6. Extend reader chat context or reader store typing so AI note source resolution can access the actual Foliate section index and chapter-start CFI fallback.
7. Add default-skill upsert/migration so existing databases receive the new skill.
