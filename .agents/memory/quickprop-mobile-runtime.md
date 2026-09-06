---
name: QuickProp Mobile Runtime
description: Compatibility constraints discovered while running the Expo agent app across native and web preview environments.
---

Use a platform-specific token store: SecureStore on native, AsyncStorage on web.

**Why:** The web SecureStore implementation can expose its API but fail during token deletion, while native SecureStore rejects AsyncStorage-style keys containing `@`.

**How to apply:** Keep native SecureStore keys limited to letters, numbers, periods, hyphens, and underscores. Route web preview token reads, writes, and deletion through AsyncStorage instead.

Pin Reanimated 3.19.1 or newer when the app stays on the legacy architecture with React Native 0.81.

**Why:** Reanimated 3.17.x references React Native APIs removed or changed in 0.81, causing Android Gradle compilation errors.

**How to apply:** If the app remains on JSC with the New Architecture disabled, do not downgrade Reanimated below the compatible 3.19 line without validating a production Android build.

Expo Go can report a generic HostFunction error while loading this project because Expo Go enables the New Architecture even when the app config disables it.

**Why:** Expo Go's native container does not match the project's standalone-build architecture settings, so a preview failure at an unrelated import does not by itself prove the production binary is broken.

**How to apply:** Treat this as a preview-environment limitation, keep the configured standalone architecture unchanged unless intentionally migrating, and validate the actual Expo Launch build on a device.

Treat Expo Go success as insufficient validation for outbound third-party URL schemes on iOS.

**Why:** Expo Go supplies its own native container, while TestFlight uses the app's generated Info.plist. A scheme can work in Expo Go but be unavailable to the standalone app unless explicitly queried in production configuration.

**How to apply:** Whitelist required third-party schemes in the standalone iOS Info.plist, validate the generated Expo config, and use the native iOS share sheet for WhatsApp text so the complete payload survives the handoff.

For WhatsApp Status media on iOS, share the listing photo and copy a concise caption rather than attempting to prefill both as one attachment.

**Why:** WhatsApp's iOS share receiver can accept the image or the message but does not reliably preserve both from an external app, including dedicated sharing libraries.

**How to apply:** Put the primary photo in the native share sheet, copy the Status-ready description first, and tell the agent to select WhatsApp → My Status and paste the caption.

The Expo static bundle script must select an available Metro port instead of assuming 8081.

**Why:** The workspace's component-preview server can occupy 8081, and Expo's non-interactive mode otherwise stops for a port-conflict prompt.

**How to apply:** Keep Metro's selected port shared by health checks, bundle requests, manifest requests, and asset URL parsing.

When using react-native-share with Expo, include its config plugin with an explicit options object and add the Expo build-properties package at the SDK-compatible version.

**Why:** The plugin can fail Expo startup when its options argument is omitted, and it imports expo-build-properties even when no extra share targets are configured.

**How to apply:** Keep the plugin entry as a two-item array with `{}` (or explicit target options), and align expo-build-properties with Expo's expected version before restarting Metro.

For targeted social sharing with react-native-share, keep the destination type narrowed to non-story Social values.

**Why:** A dynamic destination map is inferred broadly enough to include story targets, which makes `shareSingle` require an app ID even for Facebook, Instagram, and LinkedIn.

**How to apply:** Use the library's `Exclude<Social, ...Stories>` type for the destination map while keeping the native import lazy for Expo Go.

Targeted LinkedIn sharing through `react-native-share.shareSingle` can remain pending on native when the LinkedIn app or image handoff is unavailable; use the generic system share sheet for LinkedIn image sharing.

**Why:** A pending native bridge promise leaves the share tile loading indefinitely and makes the modal appear frozen.

**How to apply:** Keep LinkedIn's web flow as the LinkedIn composer URL, but route iOS and Android through the same generic image share path used by the app's other fallback shares.

For TikTok image sharing on iOS, send only the JPEG in the system share payload and copy the caption separately.

**Why:** TikTok's iOS share extension can hide itself when `react-native-share` includes both an image URL and a second text item, even though the same photo shares from Photos.

**How to apply:** Keep the TikTok path image-only on iOS; preserve the existing image-plus-caption payload on Android and leave the caption on the clipboard for pasting.

Standalone mobile release bundles need an explicit production API URL; do not rely on the development workflow's `EXPO_PUBLIC_DOMAIN` injection.

**Why:** Native release builds can otherwise compile with no API base URL, leaving cloud-only screens such as Matches unable to load while local cached screens still appear normal.

**How to apply:** Inject the verified production API URL in Android and iOS release workflows, and retain a release-only fallback in the auth context while keeping the local development fallback offline.