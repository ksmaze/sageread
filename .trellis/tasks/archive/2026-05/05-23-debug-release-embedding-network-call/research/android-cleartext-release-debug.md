# Android cleartext traffic in release vs debug

## Sources

* Android Developers: Network Security Configuration - https://developer.android.com/privacy-and-security/security-config
* Android Developers: `<application>` manifest element - https://developer.android.com/guide/topics/manifest/application-element

## Findings

* Android cleartext traffic means unencrypted HTTP traffic. Apps targeting Android 9 / API 28 or higher default to cleartext disabled unless they opt in.
* A manifest-level `android:usesCleartextTraffic="false"` causes platform HTTP/FTP stacks and WebView to refuse cleartext traffic. WebView honors this for apps targeting API 26+.
* Android documents this as best-effort for third-party/native stacks; low-level socket usage is not guaranteed to honor the flag. That matters here because SageRead has two relevant paths:
  * Settings vector model test uses frontend/browser `fetch`, which is WebView/platform-facing and is expected to be blocked by release `usesCleartextTraffic=false`.
  * EPUB indexing/search calls a Tauri Rust command and then Rust `reqwest`, which may not fail for the same reason unless the native stack or surrounding Android/Tauri layer enforces the policy.
* Android Network Security Config is the preferred precise control point for API 24+ and can allow cleartext only for intended destinations, instead of enabling all cleartext traffic globally.

## Repo mapping

* `packages/app/src-tauri/gen/android/app/build.gradle.kts` sets `manifestPlaceholders["usesCleartextTraffic"] = "false"` in `defaultConfig`.
* The same file overrides debug with `manifestPlaceholders["usesCleartextTraffic"] = "true"`.
* `packages/app/src-tauri/gen/android/app/src/main/AndroidManifest.xml` uses `android:usesCleartextTraffic="${usesCleartextTraffic}"`.
* No `res/xml/network_security_config.xml` exists under the generated Android resources.
* The manifest already has `android.permission.INTERNET`, so the likely Android-side issue is cleartext policy, not missing Internet permission.

## Implication

If the failing release operation is the vector-model settings test, the root cause is very likely release cleartext policy. If the failing operation is EPUB vectorization/RAG search, the release cleartext setting is still suspicious but not yet proven because the network request leaves through Rust `reqwest`.
