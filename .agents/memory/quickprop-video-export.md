---
name: QuickProp video export capture
description: Timing constraints for exporting QuickProp animation films from headless Chromium.
---

For headless Chromium video exports, start frame capture at the video player mount, not when the audio element reports ready. Chromium may show `paused === false` and `readyState === 4` while `currentTime` remains at zero. Use the full-duration soundtrack file as the MP4 audio input and verify the output duration, audio stream, and audible loudness—not just that an audio stream exists. A track around -38 LUFS can be technically non-silent yet sound absent; normalize to a sensible playback level without clipping when needed.

**Why:** Waiting for audio readiness shifted the captured visual timeline into the film's next loop, and the reported media clock was not usable for tracking time. A separate export also had a valid AAC stream whose level was too low to hear in normal playback.

**How to apply:** For QuickProp film exports, use player mount as the video origin, mux the soundtrack separately, measure integrated loudness and true peak, and inspect representative frames from both scenes and the final seconds before delivery.