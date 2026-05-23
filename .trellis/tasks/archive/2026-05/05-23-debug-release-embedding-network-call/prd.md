# brainstorm: debug release embedding network call

## Goal

Find the root cause for why the Android release app cannot call `http://192.168.2.57:8318/v1/embeddings` for embeddings while the debug app can, then define the smallest safe fix.

## What I already know

* The failing endpoint is plain HTTP on a local LAN IP: `http://192.168.2.57:8318/v1/embeddings`.
* The debug Android app can call the endpoint successfully.
* The release Android app cannot call the endpoint.
* The suspected area is Android network permission or cleartext/network security behavior.
* Android `INTERNET` permission is present in the generated manifest.
* The generated Android manifest sets `android:usesCleartextTraffic="${usesCleartextTraffic}"`.
* Gradle sets `usesCleartextTraffic=false` by default/release and overrides it to `true` only for the debug build type.
* There is no generated Android `network_security_config.xml`.
* Settings vector model testing uses frontend/browser `fetch`.
* EPUB vectorization and RAG search invoke Rust commands that send embedding requests with Rust `reqwest`.
* User verified that actual EPUB vectorization/RAG backend embedding calls work in release.
* The release failure is isolated to the settings vector-model test button.

## Assumptions (temporary)

* This repository contains the Android app source or generated Android configuration.
* The issue is reproducible on the same device/network when switching only between debug and release builds.
* The release endpoint configuration is intended to use this LAN HTTP embedding service, at least during local testing.
* The settings test should reflect whether the app can actually use the configured vector model.

## Open Questions

* None currently blocking.

## Requirements (evolving)

* Identify Android debug/release differences that could block `http://192.168.2.57:8318/v1/embeddings`.
* Avoid changing behavior before identifying the root cause.
* Distinguish between the frontend WebView `fetch` path and the Rust `reqwest` vectorization/search path.
* Fix or document the settings test mismatch so release users are not told the vector model failed when actual vectorization works.
* Keep release cleartext policy unchanged.
* Change settings vector-model testing to use the existing Rust embedding/vectorizer implementation path.

## Acceptance Criteria (evolving)

* [x] Root cause is tied to specific manifest, network security, build variant, endpoint config, or runtime evidence.
* [x] Proposed fix is scoped to the intended build variant/security posture.
* [x] Settings vector-model test calls the native/Rust embedding test command, not frontend browser `fetch`.
* [x] Native/Rust embedding test command reuses the same vectorizer request logic as EPUB vectorization/search.
* [x] Verification path proves release settings test can call embeddings or gives a clear runtime diagnostic.
* [x] Settings model test and actual EPUB vectorization behavior are each accounted for.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI green where applicable.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Replacing the embedding service implementation.
* Broad networking refactors unrelated to release/debug behavior.

## Technical Notes

* Task created on 2026-05-23.
* Root cause: release `usesCleartextTraffic=false` blocks the frontend/WebView `fetch` used by the settings test for HTTP endpoints; actual vectorization uses Rust `reqwest` and has been verified working in release.
* `packages/app/src-tauri/gen/android/app/src/main/AndroidManifest.xml` contains `android.permission.INTERNET` and `android:usesCleartextTraffic="${usesCleartextTraffic}"`.
* `packages/app/src-tauri/gen/android/app/build.gradle.kts` sets cleartext `false` in `defaultConfig` and `true` for `debug`.
* `packages/app/src/components/settings/vector-model-manager.tsx` tests embedding endpoints with frontend `fetch`.
* `packages/app/src-tauri/plugins/tauri-plugin-epub/src/text/vectorizer.rs` sends real vectorization requests using Rust `reqwest`.
* `packages/app/src-tauri/capabilities/mobile.json` allows Tauri HTTP plugin access to `http://*:*`, but the settings test is not using `@tauri-apps/plugin-http`.
* Existing dirty change in `AndroidManifest.xml` is whitespace-only and was present before this investigation.
* Implemented `plugin:epub|detect_embedding_dimension` as a Rust command that builds `TextVectorizer` and calls `vectorize_text` with the settings test text.
* Replaced settings-page browser `fetch` with `detectVectorModelDimension` in `packages/app/src/services/vector-model-service.ts`.
* Moved `normalizeEmbeddingsUrl` to side-effect-free `packages/app/src/utils/embeddings.ts` and re-exported it from `utils/model.ts`.
* Verification run: focused service test, model/service tests, `cargo check`, `pnpm --filter app build`, Biome check for touched TypeScript files.

## Research References

* [`research/android-cleartext-release-debug.md`](research/android-cleartext-release-debug.md) - Android cleartext policy explains WebView/frontend release failures and is suspicious but not yet conclusive for Rust `reqwest`.

## Technical Approach

Add a small native command to the existing EPUB/vectorizer plugin that builds a `TextVectorizer` from the supplied embeddings URL, model, and API key, then calls the same `vectorize_text` request path used by EPUB vectorization/search. Replace the settings-page browser `fetch` test with a frontend service wrapper around that command.

## Decision (ADR-lite)

**Context**: The app has two embedding request paths. Real vectorization/search uses Rust `reqwest` and works in Android release; the settings test uses WebView `fetch` and fails for local HTTP in release because cleartext traffic is disabled.

**Decision**: Keep release cleartext disabled and move settings vector-model testing onto the Rust vectorizer path.

**Consequences**: Settings tests will match real vectorization behavior. The fix adds one native command but avoids broad release network policy changes.
