# Fix Quick Action `r.some is not a function`

## Goal

Fix the runtime error shown after clicking chat quick actions, especially after the AI learning-note quick action changes. The quick action should submit a prompt and stream an assistant response without crashing the chat transport.

## What I already know

* User reports clicking `quickAction` shows `r.some is not a function`.
* The most recent related work added the `createNote` and `resolveNoteSource` AI tools plus the "生成学习笔记" quick action.
* Quick actions call `handleSubmit(prompt)` from `ChatInputArea`.
* AI SDK tool conversion commonly expects the `tools` option passed to `convertToModelMessages` to match the message tool parts it may encounter.
* Confirmed root cause: in AI SDK 6, `convertToModelMessages(...)` is async. Passing the unresolved Promise to `streamText` lets prompt standardization call `.some()` on a Promise.

## Assumptions

* The bug is caused by an unresolved async AI SDK conversion at the chat transport boundary, not by the quick action button itself.
* The fix should preserve existing quick actions, mindmap generation, note querying, and AI learning-note direct-save behavior.

## Requirements

* Clicking a quick action must not throw `r.some is not a function`.
* The chat transport must only pass AI SDK-compatible tool definitions to AI SDK message conversion and streaming APIs.
* Existing tool rendering should keep working for `mindmap`, RAG, note query, source resolution, and note creation outputs.
* Add a focused regression test for the quick-action/tool-shape failure class where feasible.

## Acceptance Criteria

* [x] A focused test fails before the fix and passes after the fix.
* [x] `pnpm --filter app build` passes.
* [x] Relevant Biome checks pass for touched TypeScript files.
* [x] `cargo check --manifest-path packages/app/src-tauri/Cargo.toml` is run if Rust files change. Not applicable: no Rust files changed.
* [x] Root cause and prevention are captured with `trellis-break-loop` after the fix.

## Definition of Done

* Root cause is identified before implementation.
* The minimal fix is implemented.
* Regression coverage is added.
* Quality checks pass.
* Relevant spec/guides are updated if this reveals a reusable rule.

## Out of Scope

* Redesigning quick actions.
* Implementing the passive note draft/edit card flow.
* Changing AI provider behavior unrelated to this runtime crash.

## Technical Notes

* Likely files:
  * `packages/app/src/ai/custom-chat-transport.ts`
  * `packages/app/src/ai/hooks/use-chat.ts`
  * `packages/app/src/components/side-chat/chat-input-area.tsx`
  * `packages/app/src/ai/tools/*`
* Need inspect recent commit `91896ab Add AI learning note generation`.
