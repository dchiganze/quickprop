# QuickProp — Complete Edited Promo Preview

## Director's treatment

- **Promise:** Put the complete edited QuickProp promo directly into the existing video artifact so viewers can play the footage without following a separate video link.
- **Identity:** Preserve the supplied QuickProp film's picture, grade, edit, subtitles, and audio; refine only the requested lower-third overlays. The canvas remains 16:9.
- **Hero:** The supplied complete MP4, shown edge-to-edge inside the 16:9 preview canvas without crop or re-edit.
- **Motion:** Keep the source footage's original motion and transitions. The founder credit and two section labels remain restrained, fixed lower-thirds.
- **Arc:** Play the MP4 from its opening frame through its original final frame, then stop in the preview.
- **Payoff:** The original final image and soundtrack resolve naturally and remain at the endpoint.
- **Runtime:** The latest supplied source is 41.709 seconds; the encoded 30 fps preview is 41.700 seconds (1,251 frames), and its preview clock uses one 41,700 ms scene.
- **Sound:** Preserve and loudness-normalize the latest source MP4's AAC audio to approximately -16 LUFS integrated and -1.5 dBTP. Start muted for reliable browser autoplay; the workspace mute control enables the source audio. No added bed, voiceover, or sound effects.

## Timeline overview

| Time | View | Playback | Handoff |
| --- | --- | --- | --- |
| 0.000–9.000s | Founder credit over opening interview | White, black-outlined “Douglas Chiganze, QuickProp Founder” at bottom-left, about one-fifth frame height above the bottom; source picture and subtitles remain visible | Credit ends cleanly at 9 seconds |
| 9.000–10.000s | Interview continues | Continue the supplied edit without added copy | Cut into listing section |
| 9.000–12.800s | Listing details | Raise “QuickProp Agent — Listing Details” to one-fifth of frame height above bottom | Original label location is cleared; preserve footage and subtitles |
| 12.800–16.000s | WhatsApp share | Raise “Property Flyer — Caption Prefilled” to one-quarter of frame height above bottom | Original label location is cleared; preserve footage and subtitles |
| 16.000–41.700s | Complete edited promo | Play the rest of the supplied H.264 video and normalized original audio | Hold on the source endpoint; no automatic preview restart |

## Full shot script

### Shot 01 / 0.000–41.700s / 41.700s — “Complete promo”

**Purpose:** Present the entire edited promo in the artifact itself, preserving the complete source rather than showing a link, recreating the footage, or assembling a new cut.

**Exact content:** The complete image from `attached_assets/Untitled_design_(2)_1793863940234.mp4`, 1920×1080 H.264 at 30 fps with AAC stereo audio. A white, black-outlined “Douglas Chiganze, QuickProp Founder” credit sits bottom-left, roughly one-fifth of the frame height above the bottom, from 0.000 through 9.000 seconds only. In the listing section, “QuickProp Agent — Listing Details” is raised to roughly one-fifth of the frame height above the bottom; in the WhatsApp share section, “Property Flyer — Caption Prefilled” is raised to roughly one-quarter of the frame height above the bottom. Only the old title positions are cleared; the source's yellow spoken subtitles remain visible and unchanged.

**Composition and artistic idea:** A single 16:9 video surface fills the persisted 16:9 canvas. `object-fit: contain` preserves the complete frame without cropping. The canvas uses a quiet deep-green-black surround only where the browser viewport does not share the source ratio.

**Timed choreography:** 0.000s: begin on the source's own opening frame with the white founder credit in the lower-left, raised from its previous position. 0.000–9.000s: show the credit; it is absent from 9.000s onward. 9.000–12.800s: raise the listing details label. 12.800–16.000s: raise the flyer caption label. 16.000–41.709s: continue through the complete provided edit and normalized original sound without added copy. At 41.709s, hold on the final source frame in preview.

**Transition contract:** There is no automatic preview loop handoff. The supplied video element plays the complete original file without trimming or splicing, then holds at its endpoint unless the viewer explicitly enables the existing loop-current-scene control.

**Assets and technique:** The latest supplied MP4 is the sole visual source. The H.264/AAC output retains its 1920×1080, 30 fps composition, adds the timed founder credit and raised section labels, and clears only the old label positions; the yellow spoken subtitles remain intact. Source audio is loudness-normalized before AAC encoding. A VP9/Opus WebM compatibility fallback is encoded from the same revised composition and normalized audio. The embedded preview keeps MP4 first and WebM second. Workspace playback controls sit outside the composition.

**Sound intent:** Preserve the latest source's AAC stereo soundtrack and normalize it to approximately -16 LUFS integrated with a -1.5 dBTP ceiling in both downloadable formats. The preview starts muted so the video can autoplay reliably; the workspace mute control enables audio.

## Review and playback contract

- One continuous source-video shot; there are no new scenes or editorial changes.
- The complete 1920×1080 source remains 16:9, 30 fps, and is displayed without crop.
- Runtime clock: `SCENE_DURATIONS.completePromo = 41700` ms. Uploaded source duration: 41.709 seconds; the 30 fps export is 41.700 seconds.
- Original audio remains in the video; no separate soundtrack is mixed. Its downloadable MP4 and WebM versions are loudness-normalized. Autoplay starts muted, and the workspace control bar can unmute it.
- Browser playback is inline and autoplay attempted, but stops at the source endpoint rather than looping automatically. The workspace control bar pauses, resumes, mutes, reports the preview duration, and can still explicitly enable its loop-current-scene control.
- The preview references `QuickProp_UntitledDesign2_Overlays_Audible_1080p_30fps.mp4` first and `QuickProp_UntitledDesign2_Overlays_Audible_1080p_30fps_compatible.webm` second. Both are 41.700-second exports from the latest 41.709-second upload, with normalized audio, unchanged spoken subtitles, the timed founder credit, and raised title labels. Playback does not automatically loop.
