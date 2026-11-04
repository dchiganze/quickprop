---
name: QuickProp video preview compatibility
description: Codec fallback for videos embedded in Replit workspace previews.
---

Do not rely on MP4/H.264 alone for an embedded QuickProp video preview. A valid H.264 source can return successful byte-range responses while the workspace preview browser still rejects it as unsupported. Include a compatible WebM fallback with matching framing and soundtrack.

**Why:** the 1080p QuickProp promo was served correctly as MP4, but the actual preview browser raised `NotSupportedError`; the WebM fallback rendered successfully.

**How to apply:** For embedded film media, include an MP4 source and a WebM VP9/Opus fallback, then verify the real artifact preview in addition to checking HTTP headers or range requests.
