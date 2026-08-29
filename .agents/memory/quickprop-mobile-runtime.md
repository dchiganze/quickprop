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