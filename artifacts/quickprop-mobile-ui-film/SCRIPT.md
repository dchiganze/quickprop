# QuickProp — Complete Edited Promo Preview

## Director's treatment

- **Promise:** Put the complete edited QuickProp promo directly into the existing video artifact so viewers can play the footage without following a separate video link.
- **Identity:** Preserve the supplied QuickProp film's picture, grade, edit, subtitles, and audio; refine only the requested lower-third overlays. The canvas remains 16:9.
- **Hero:** The supplied complete MP4, shown edge-to-edge inside the 16:9 preview canvas without crop or re-edit.
- **Motion:** Keep the source footage's original motion and transitions. The founder credit and two section labels remain restrained, fixed lower-thirds.
- **Arc:** Play the MP4 from its opening frame through its original final frame, then loop in the preview.
- **Payoff:** The original final image and soundtrack resolve naturally before the preview returns to the untouched opening.
- **Runtime:** 41.708 seconds in the source; the preview clock uses one 41,708 ms scene.
- **Sound:** Preserve the MP4's original AAC audio. Start muted for reliable browser autoplay; the workspace mute control enables the source audio. No added bed, voiceover, or sound effects.

## Timeline overview

| Time | View | Playback | Handoff |
| --- | --- | --- | --- |
| 0.000–9.000s | Founder credit over opening interview | White, black-outlined lower-left credit; source picture and subtitles remain visible | Credit ends cleanly at 9 seconds |
| 9.000–10.000s | Interview continues | Continue the supplied edit without added copy | Cut into listing section |
| 10.000–12.800s | Listing details | Raise “QuickProp Agent — Listing Details” to one-fifth of frame height above bottom | Original label location is cleared; preserve footage and subtitles |
| 12.800–16.000s | WhatsApp share | Raise “Property Flyer — Caption Prefilled” to one-quarter of frame height above bottom | Original label location is cleared; preserve footage and subtitles |
| 16.000–41.708s | Complete edited promo | Play the rest of the supplied H.264 video and original audio | At the source endpoint, native looping restarts at the first source frame |

## Full shot script

### Shot 01 / 0.000–41.708s / 41.708s — “Complete promo”

**Purpose:** Present the entire edited promo in the artifact itself, preserving the complete source rather than showing a link, recreating the footage, or assembling a new cut.

**Exact content:** The complete image and original soundtrack from the supplied QuickProp promo. The source is 1920×1080 H.264 at 30 fps; the preview MP4 retains AAC audio. A white, black-outlined “Douglas Chiganze, QuickProp Founder” credit sits bottom-left, roughly one-fifth of the frame height above the bottom, from 0.000 through 9.000 seconds only. In the listing section, “QuickProp Agent — Listing Details” is moved to roughly one-fifth of the frame height above the bottom; in the WhatsApp share section, “Property Flyer — Caption Prefilled” is moved to roughly one-quarter of the frame height above the bottom. Original label positions are cleared so only the raised versions remain. Original subtitles, footage, edit, and soundtrack are preserved.

**Composition and artistic idea:** A single 16:9 video surface fills the persisted 16:9 canvas. `object-fit: contain` preserves the complete frame without cropping. The canvas uses a quiet deep-green-black surround only where the browser viewport does not share the source ratio.

**Timed choreography:** 0.000s: begin on the source's own opening frame with the white founder credit in the lower-left, raised from its previous position. 0.000–9.000s: show the credit; it is absent from 9.000s onward. 10.000–12.800s: raise the listing details label. 12.800–16.000s: raise the flyer caption label. 16.000–41.708s: continue through the complete provided edit and original sound without added copy. At 41.708s, return to 0.000s for preview looping.

**Transition contract:** The only loop handoff is the source video's own endpoint to its first frame. The supplied video element loops the original file without trimming or splicing it.

**Assets and technique:** Replace both public media sources with versions of the newly supplied complete H.264/AAC MP4. The H.264 output retains AAC audio and adds the timed founder credit plus the two relocated section labels; the original subtitle track is burned into the image and is unchanged. A VP9/Opus WebM compatibility fallback is encoded from the same revised 1920×1080, 30 fps composition. The embedded preview keeps MP4 first and WebM second. Workspace playback controls sit outside the composition.

**Sound intent:** Preserve the original AAC soundtrack in the source file. The preview starts muted so the video can autoplay reliably; the workspace mute control enables audio without changing the media.

## Review and playback contract

- One continuous source-video shot; there are no new scenes or editorial changes.
- The complete 1920×1080 source remains 16:9, 30 fps, and is displayed without crop.
- Runtime clock: `SCENE_DURATIONS.completePromo = 41708` ms. Source duration: 41.709 seconds.
- Original audio remains in the video; no separate soundtrack is mixed. Autoplay starts muted, and the workspace control bar can unmute it.
- Browser playback is inline, autoplay attempted, and loops at the source endpoint. The workspace control bar pauses, resumes, mutes, and reports the preview duration.
- The preview references the revised H.264/AAC MP4 first and the VP9/Opus compatibility transcode second. Both are complete 41.709-second files with the original audio; only the requested credit and title positions are changed.
