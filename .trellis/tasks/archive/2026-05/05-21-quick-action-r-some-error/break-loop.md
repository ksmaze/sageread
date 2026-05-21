## Bug Analysis: Quick Action `r.some is not a function`

### 1. Root Cause Category

- **Category**: E - Implicit Assumption, plus D - Test Coverage Gap
- **Specific Cause**: `convertToModelMessages(...)` is async in AI SDK 6. `CustomChatTransport` treated it as a synchronous `ModelMessage[]` and passed the unresolved Promise to `streamText`. AI SDK prompt standardization later inspected `messages.some(...)`, so a quick-action submission failed with `r.some is not a function` in bundled output.

### 2. Why Fixes Failed (if applicable)

1. Initial assumption: the failure looked like a quick-action/tool shape mismatch because it appeared after learning-note tool work. The real boundary was earlier: UI-message to model-message conversion.
2. Type/build coverage: the old code built successfully, but no focused regression test imported the conversion boundary and asserted the resolved runtime shape.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Architecture | Route chat UI-message conversion through `prepareModelMessagesForStream(...)` and await SDK conversion before `streamText`. | DONE |
| P0 | Test Coverage | Add a focused Node test for a quick-action-style prompt that asserts conversion returns a `ModelMessage[]`. | DONE |
| P1 | Documentation | Document the AI chat transport conversion contract in the frontend state spec. | DONE |
| P1 | Thinking Guide | Add SDK async conversion as a cross-layer boundary mistake/checklist item. | DONE |

### 4. Systematic Expansion

- **Similar Issues**: Searched `packages/app/src` for `convertToModelMessages`, `toModelMessages`, and `streamText(`. Only the chat transport path uses this conversion today.
- **Design Improvement**: Keep SDK boundary conversions in small pure helpers so tests can run without Tauri, Zustand, or browser globals.
- **Process Improvement**: When upgrading or using AI SDK helpers, verify whether conversion/normalization helpers are async even when their eventual output looks like plain data.

### 5. Knowledge Capture

- [x] Updated `.trellis/spec/app/frontend/state-management.md` with the AI chat transport message conversion contract.
- [x] Updated `.trellis/spec/guides/cross-layer-thinking-guide.md` with the SDK async conversion boundary.
- [x] Added regression coverage in `packages/app/src/ai/model-message-conversion.test.ts`.
- [x] No `src/templates/markdown/spec/` tree exists in this repository, so there is no template mirror to sync.
