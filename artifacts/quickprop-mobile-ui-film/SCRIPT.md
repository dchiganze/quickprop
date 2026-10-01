# QuickProp Agent — Mobile UI Film

## Director's treatment

- **Promise:** QuickProp Agent gives property agents a clear place to discover collaboration matches and share a polished listing catalogue.
- **Identity:** 16:9 landscape. QuickProp green `#2C6D5D`, ink, warm white, and pale mint; Plus Jakarta Sans for the product-led display and interface typography.
- **Hero:** Two faithful, readable mobile app screens inside one physical phone: the Matches tab, then the QuickShare catalogue panel.
- **Motion:** UI-native card reveals, a slow camera push across the phone, and a selected-state shape carried between screens.
- **Arc:** The matching interface resolves first; its highlighted match becomes the selected brochure state and opens the share-channel interface.
- **Payoff:** The channel grid settles inside the real QuickShare UI and holds as the final frame; no separate title or logo card interrupts the two-screen brief.
- **Runtime:** 10 seconds total: exactly 5 seconds per screen.
- **Sound:** One restrained, upbeat instrumental pulse supports the screen changes without competing with interface copy. No voiceover or sound effects.

## Timeline overview

| Time | Screen | Main motion | Handoff |
| --- | --- | --- | --- |
| 0.00–5.00s | Matches | A collaboration listing resolves, its open status and request action become clear | The green “Open” badge expands into the selected brochure outline |
| 5.00–10.00s | QuickShare | Brochure scope, preview details, and sharing channels resolve in sequence | The highlighted share tile becomes the opening “Open” badge on loop |

## Full shot script

### Shot 01 / 0.00–5.00s / 5.00s — “Matches”

**Purpose:** Show the actual QuickProp Agent Matches tab, with its collaboration discovery tools and a listing ready for an agent's request.

**Exact content:** App screen text: “Matches”; “Discover, collaborate, and track requests”; “Saved alerts”; “3 criteria · 2 new”; search hint “Road, suburb, amenities, size, beds, price…”; tabs “Discover”, “Requests (2)”, and “Sent”; section label “LISTINGS FOR YOU”; sort label “Newest”; listing status “FOR SALE” and “Open”; “4-bed in Borrowdale”; “Harare · QP-2418”; “USD 285,000”; “4”, “3”, and “Borehole”; action “Request collaboration”. A second listing resolves below it: “3-bed in Avondale” and “Harare · QP-1986”. The left detail card repeats the listing with “COLLABORATION LISTING”, “4-BED · FOR SALE”, “Borrowdale”, “Harare”, “USD 285,000”, “QP-2418”, “4 beds”, “3 baths”, “Borehole”, and “Request collaboration”. The app tab bar reads “Home”, “Listings”, “Matches”, “Share”, “Profile”. Exterior labels read “01”, “MATCHES”, “DISCOVER · COLLABORATE · TRACK”, “QUICKPROP AGENT”, and “COLLABORATION DISCOVERY”.

**Composition and artistic idea:** One upright, softly angled phone occupies the right half of the 16:9 frame and nearly the full short edge. Its screen recreates the app's light background, green active states, saved-alert row, search field, three tabs, and stacked collaboration cards. On the left, a restrained ink field carries only the screen label and a thin mint connector terminating at the featured listing's green “Open” badge. The camera pushes closer to the native UI rather than introducing unrelated marketing copy.

**Timed choreography:** 0.00–0.25s: the phone screen is already visible; the phone settles from a slight 1.06× overscale and 3° rotation. 0.25–0.80s: the Matches header and saved-alert summary sharpen into focus. 0.80–1.40s: the search field and Discover/Requests/Sent tabs trace on in place. 1.40–2.20s: the Borrowdale collaboration listing reveals from its photo edge to its title and property details. 2.20–3.10s: the green “Request collaboration” button resolves; a mint focus line traces from the action toward the listing's “Open” badge. 3.10–4.25s: a second card peeks in beneath the first while the camera advances a restrained 1.08× toward the featured card. 4.25–5.00s: the “Open” badge grows from a pill into the green selected outline that begins the transition.

**Transition contract:** The outgoing green “Open” pill stays screen-positioned and expands through the lens. The next shot's selected “My Brochure” outline begins at the same centre and scale; a diagonal pane split reveals the new screen beneath the expanding pill. The phone remains the persistent hero.

**Assets and technique:** Original CSS-rendered mobile screen artwork based on `artifacts/mobile/app/(tabs)/matches.tsx`, with typography, tabs, listing cards, and icons reconstructed from the app's real labels and hierarchy. CSS geometric property artwork stands in for a listing thumbnail; no generated text or third-party imagery.

**Sound intent:** A soft opening pulse, two restrained UI-like musical accents as the listing details resolve, then a light rise into the ring transition. All beat alignment remains unverified until the instrumental exists.

### Shot 02 / 5.00–10.00s / 5.00s — “QuickShare”

**Purpose:** Show the real catalogue-sharing interface, its brochure preview, and the destinations an agent can use to send it.

**Exact content:** Dimmed app underneath the sheet reads “Good morning, Tendai”, “My listings”, “12 active listings”, “View all”, “Borrowdale family home”, “4 beds · For sale”, and the tab labels “Home”, “Listings”, “Matches”, “Share”, “Profile”. The QuickShare panel reads “QUICKPROP AGENT”, “QuickShare”, “My Brochure”, “Your listings only”, “Company”, and “All agency listings”. Its preview reads “Tendai’s Listings”, “Borrowdale, Avondale & more”, “12 properties”, “All details ready”, “4-bed · Borrowdale”, and “3-bed · Avondale”. Below are “SHARE VIA”, “WhatsApp”, “Facebook”, “Instagram”, “LinkedIn”, and “More sharing options”. The enlarged brochure shows the existing QuickProp logo asset, followed by “PROPERTY COLLECTION”, “MY BROCHURE”, “Tendai’s Listings”, “Borrowdale, Avondale & more”, “12 properties”, and “VIEW COLLECTION”. Exterior labels read “02”, “QUICKSHARE”, “ONE BROCHURE · EVERY CHANNEL”, “CATALOGUE PREVIEW”, and “READY WHEN YOU ARE”.

**Composition and artistic idea:** The same phone opens onto the actual QuickShare sheet. The first half-second preserves the outgoing pill as the green selected edge around “My Brochure”; the rest of the interface stays a clean, readable warm-white sheet over a muted app backdrop. The camera reframes from the upper mode selector to the catalogue preview and then to the four branded destination tiles. The external label moves to the opposite side from Shot 01, keeping focus on the app screen.

**Timed choreography:** 0.00–0.35s: the green ring resolves into the “My Brochure” selected border as the new screen unfolds in two masked panes. 0.35–1.05s: “QuickShare” and the “My Brochure / Company” mode cards settle. 1.05–2.10s: the catalogue preview grows from its top edge; title, property count, and two property rows resolve one at a time. 2.10–3.20s: “SHARE VIA” appears; WhatsApp, Facebook, Instagram, and LinkedIn tiles reveal in a measured stagger. 3.20–4.25s: the camera pushes toward the channel row; a soft green focus sweep highlights WhatsApp, then rests without implying that a share was sent. 4.25–5.00s: the whole UI holds readable; the WhatsApp tile's green icon enlarges to become the outgoing loop carrier.

**Transition contract:** The WhatsApp green icon scales up and becomes the green “Open” pill at the beginning of Shot 01. The two-pane mask clears as the loop returns to the Matches UI; there is no separate brand or end card.

**Assets and technique:** Original CSS-rendered mobile screen artwork based on `artifacts/mobile/components/QuickShareSheet.tsx`. Use the real channel brand colors and Lucide icons; show the selected brochure preview as interface artwork, not as an invented claim that a share completed. Property names, prices, references, and counts are illustrative screen-demonstration details, not live listing claims.

**Sound intent:** Maintain the same instrumental pulse, with a soft lift as the channel destinations appear and a resolved but loop-friendly final beat. No voiceover or sound effects; beat alignment remains unverified.

## Variety and floor review

- The two shots share a device frame but differ in content hierarchy and camera target: collaboration discovery first, brochure and channels second.
- The app UI occupies the visual centre and more than 60% of the short edge; exterior copy remains secondary.
- Each five-second scene has several timed changes and an outgoing handoff in its final 15%.
- Both transitions carry a green interface state, so the cut remains tied to the product.
- All copy is taken from the mobile app's actual screen structure except clearly marked illustrative listing details.