# QuickProp Agent — Mobile Listing & WhatsApp Film

## Director's treatment

- **Promise:** A property listing in QuickProp Agent becomes a polished flyer and a ready-to-send WhatsApp message.
- **Identity:** 16:9 landscape. QuickProp green `#2C6D5D`, ink, warm white, and pale mint; Plus Jakarta Sans for the product-led display and interface typography.
- **Hero:** A readable mobile listing detail screen, then a WhatsApp share composer with the property flyer and exact caption.
- **Motion:** Listing-detail reveals, a selected share-action pulse, and a diagonal screen handoff.
- **Arc:** The listing's published details resolve before its share action hands the property image into WhatsApp; the exact message caption appears beneath it.
- **Payoff:** The complete flyer-and-caption composer holds in the phone as a pre-send state. The send control is visible but the film does not imply that a message was sent.
- **Runtime:** Exactly 7 seconds total: 3.5 seconds for the listing and 3.5 seconds for the WhatsApp composer.
- **Sound:** One restrained, upbeat instrumental pulse supports the screen changes without competing with interface copy. No voiceover or sound effects.

## Timeline overview

| Time | Screen | Main motion | Handoff |
| --- | --- | --- | --- |
| 0.00–3.50s | Listing detail | The published property photo, location, price, specs, and share action resolve | The share action scales through the lens into the flyer attachment |
| 3.50–7.00s | WhatsApp compose | A property flyer lands in the WhatsApp composer; the exact caption and recipient state appear | The green send affordance lifts toward the opening share action; no send is completed |

## Full shot script

### Shot 01 / 0.00–3.50s / 3.50s — “Listing detail”

**Purpose:** Show a QuickProp Agent property detail page as the natural starting point for sharing a single listing.

**Exact content:** App listing detail text: reference “QP-2418”; status “Published”; “FOR SALE”; “RESIDENTIAL”; “3 bedroom home”; “Avondale, Harare”; “USD 275,000”; “3 beds”; “2 baths”; “2 garages”; “ABOUT THIS HOME”; “A light-filled family home with generous living spaces and a private garden.”; “ASKING PRICE”; “Share”. The exterior labels read “01”, “LISTING”, “A PROPERTY, READY TO SHARE”, “QUICKPROP AGENT”, and “LISTING DETAILS”. Listing details are illustrative demonstration content, not a live listing claim.

**Composition and artistic idea:** A tall upright phone occupies the right side and most of the short edge. The app listing's architectural photograph is the screen's dominant image; the white details panel and persistent share-price footer follow the actual listing-detail hierarchy. A small light fact card floats in the left negative space. The recurring green share control is the match-cut carrier.

**Timed choreography:** 0.00–0.30s: the phone arrives already recognizable, settling from a slight overscale and perspective tilt. 0.30–0.72s: the top reference and property photo sharpen; “Published” sits over the image. 0.42–0.85s: a fact card opens at left. 1.18–1.55s: bed, bath, and garage specs lift into view. 1.59–1.95s: the short home description resolves under a slight camera push. 2.33–2.85s: a mint selection halo blooms around Share and the icon gives a restrained scale pulse. 2.85–3.50s: the listing crop advances and a diagonal clip reveal opens the WhatsApp composer on the 3.50s music accent; the share green is echoed by its send affordance.

**Transition contract:** The outgoing green Share affordance is echoed by the incoming WhatsApp send affordance. A diagonal clip reveal and restrained full-screen scale overlap the cut; the phone remains the hero object. The film does not represent a completed tap or send.

**Assets and technique:** Original CSS-rendered listing detail screen based on `artifacts/mobile/app/listing/[id].tsx`; hierarchy follows its top actions, gallery, published badge, listing price, facts, and share entry. Architectural artwork is a stylized, drawn demonstration home, not listing photography. Lucide icons and the existing device frame are used.

**Sound intent:** Preserve the original instrumental character. The cut at 3.50s is aligned to the measured RMS onset. No voiceover or sound effects.

### Shot 02 / 3.50–7.00s / 3.50s — “WhatsApp compose”

**Purpose:** Make the single-listing handoff unmistakable: the flyer is attached, WhatsApp is open, and the current app caption is present in a pre-send composer.

**Exact content:** WhatsApp-style compose UI labels “WhatsApp” and “Share listing”, with the selected recipient “You”. Flyer artwork uses QuickProp logo asset, “PROPERTY LISTING”, “3 BEDROOM HOME”, “AVONDALE, HARARE”, “USD 275,000”, “3 Bedrooms”, “2 Bathrooms”, “2 Garages”, and “Powered by quickprop.co.zw”. The caption appears exactly as entered in the app: “Follow this link to see all my properties www.quickprop.co.zw/douglaschiganze”. Exterior labels read “02”, “WHATSAPP”, “FLYER + MESSAGE · READY TO SEND”, “PROPERTY FLYER”, and “CAPTION PREFILLED”. The send affordance is visible; no completed-send claim is made.

**Composition and artistic idea:** The phone stays in the same right-hand zone but the screen flips into a dark WhatsApp composer, contrasting the light listing view. The flyer is a compact 4:5 editorial card, following the real mobile PropertyFlyer template's hierarchy: brand/photo, headline, accent price bar, specifications, and QuickProp footer. The exact caption is in the attachment card directly beneath the flyer artwork; recipient and green send control remain visible at the bottom, establishing a ready-to-send but unsent state.

**Timed choreography:** 0.00–0.42s: the listing's diagonal reveal clears to the WhatsApp screen; the status/header and dark compose surface are present during the cut. 0.12–0.78s: flyer artwork lands as a single attachment and settles square in its card. 0.76–1.24s: the exact caption reveals beneath the flyer artwork and holds readable. 1.24–1.90s: recipient “You” and the send affordance remain visible beneath the attachment. 1.90–2.65s: a restrained green focus halo blooms around the send button without indicating a tap. 2.65–2.90s: the complete attachment-and-caption composition holds for a clear read. 2.90–3.50s: the green send icon scales forward as a loop echo; it remains visibly a composer action, not a sent message.

**Transition contract:** The enlarged green send affordance acts as a color-and-shape echo of Shot 01's green Share button on the loop. The next listing view resets to its original scale; no completed-send state is shown.

**Assets and technique:** Original CSS-rendered compose state based on the mobile share behavior in `artifacts/mobile/app/listing/[id].tsx`, `artifacts/mobile/components/ShareHubSheet.tsx`, and `artifacts/mobile/components/PropertyFlyer.tsx`. The caption string is confirmed from `artifacts/mobile/utils/shareContent.ts`. The provided screenshot is a layout reference only; its old caption and DBT Properties branding are deliberately not reproduced. Property details are illustrative, not live listing claims.

**Sound intent:** Continue the time-stretched instrumental bed and resolve on the final held composer view. No voiceover or sound effects; the loop tail retains the original soft resolution.

## Variety and floor review

- The two shots share the device frame but contrast a light property-detail screen against the dark WhatsApp compose state.
- The listing's image becomes the flyer attachment; the sequence clearly shows listing → WhatsApp composer.
- Runtime is exactly 7.00 seconds: 3.50 + 3.50. The persisted 16:9 ratio is unchanged.
- Both transitions carry the green share/send affordance without claiming that a message was sent.
- The exact current caption is reproduced verbatim; provided screenshot copy is not reused.

## Audio spec

- Runtime: 7.00s (SCENE_DURATIONS = 3.50s + 3.50s).
- Music: Preserve the existing restrained, upbeat instrumental pulse; time-stretch the original 10.000s master to 7.00s with pitch-preserving `atempo=10/7`, retaining its soft resolved tail. No vocals, voiceover, or added SFX.
- Measured RMS onsets in the replacement bed: 1.750s, 3.500s, and 5.250s (50ms RMS windows, >=6dB rise). The listing-to-WhatsApp cut is aligned to the strong 3.500s onset; total runtime remains exactly 7.00s.
- Playback file: `src/assets/quickprop-mobile-ui-bed.wav` (import path and player wiring unchanged).