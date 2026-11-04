# QuickProp — Complete Edited Promo Preview

## Director's treatment

- **Promise:** Put the complete edited QuickProp promo directly into the existing video artifact so viewers can play the footage without following a separate video link.
- **Identity:** Preserve the source film's own picture, grade, edit, titles, and audio. The canvas remains 16:9.
- **Hero:** The supplied complete MP4, shown edge-to-edge inside the 16:9 preview canvas without crop or re-edit.
- **Motion:** Use the source footage's original motion and transitions; the preview adds no overlays or editorial treatment.
- **Arc:** Play the MP4 from its opening frame through its original final frame, then loop in the preview.
- **Payoff:** The original final image and soundtrack resolve naturally before the preview returns to the untouched opening.
- **Runtime:** 41.708 seconds in the source; the preview clock uses one 41,708 ms scene.
- **Sound:** Preserve the MP4's original AAC audio. Start muted for reliable browser autoplay; the workspace mute control enables the source audio. No added bed, voiceover, or sound effects.

## Timeline overview

| Time | View | Playback | Handoff |
| --- | --- | --- | --- |
| 0.000–41.708s | Complete edited promo | Play the supplied H.264 video continuously with original audio | At the source endpoint, native looping restarts at the first source frame |

## Full shot script

### Shot 01 / 0.000–41.708s / 41.708s — “Complete promo”

**Purpose:** Present the entire edited promo in the artifact itself, preserving the complete source rather than showing a link, recreating the footage, or assembling a new cut.

**Exact content:** The complete image and original soundtrack from `generated-artifacts/QuickProp_Promo_5_Founder_Credit_1080p.mp4`. The source is 1920×1080 H.264 with AAC audio. Its white lower-left founder credit is visible from 0.000 to 9.000 seconds only. No new copy, title, credit, or graphic is added.

**Composition and artistic idea:** A single 16:9 video surface fills the persisted 16:9 canvas. `object-fit: contain` preserves the complete frame without cropping. The canvas uses a quiet deep-green-black surround only where the browser viewport does not share the source ratio.

**Timed choreography:** 0.000s: begin on the source's own opening frame. 0.000–9.000s: retain the source's lower-left white founder credit exactly as authored. 9.000–41.708s: continue uninterrupted through the complete provided edit and original sound. At 41.708s, return to 0.000s for preview looping; no new transition is composited over the source.

**Transition contract:** The only loop handoff is the source video's own endpoint to its first frame. The supplied video element loops the original file without trimming or splicing it.

**Assets and technique:** The original H.264/AAC MP4 remains the preferred browser source in the artifact's `public/` path. Since the workspace preview browser does not decode this MP4, provide a VP9/Opus WebM compatibility fallback made from the same complete source, with identical 1920×1080 framing and no editorial changes. Both public files are symlinks to files in the already git-ignored `generated-artifacts/` directory, keeping media bytes out of Git history. Workspace playback controls sit outside the composition.

**Sound intent:** Preserve the original AAC soundtrack in the source file. The preview starts muted so the video can autoplay reliably; the workspace mute control enables audio without changing the media.

## Review and playback contract

- One continuous source-video shot; there are no new scenes or editorial changes.
- The complete 1920×1080 source remains 16:9 and is displayed without crop.
- Runtime clock: `SCENE_DURATIONS.completePromo = 41708` ms. Source duration: 41.708333 seconds.
- Original audio remains in the video; no separate soundtrack is mixed. Autoplay starts muted, and the workspace control bar can unmute it.
- Browser playback is inline, autoplay attempted, and loops at the source endpoint. The workspace control bar pauses, resumes, mutes, and reports the preview duration.
- The preview references the original MP4 first and a VP9/Opus compatibility transcode second. The source MP4 is unchanged; both media files stay under the existing ignored `generated-artifacts/` directory, outside Git history.
