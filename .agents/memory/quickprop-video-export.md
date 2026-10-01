---
name: QuickProp video export capture
description: Timing constraints for exporting QuickProp animation films from headless Chromium.
---

For headless Chromium video exports, start frame capture at the video player mount, not when the audio element reports ready. Chromium may show `paused === false` and `readyState === 4` while `currentTime` remains at zero. Use the full-duration soundtrack file as the MP4 audio input and verify the output duration, audio stream, and non-silent levels.

**Why:** Waiting for audio readiness shifted the captured visual timeline into the film's next loop, and the reported media clock was not usable for tracking time.

**How to apply:** For QuickProp film exports, use player mount as the video origin, mux the soundtrack separately, and inspect representative frames from both scenes and the final seconds before delivery.