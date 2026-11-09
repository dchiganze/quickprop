---
name: QuickProp Brochure Filtering
description: Domain distinction needed when filtering or rendering customised property brochures.
---

Mobile brochure filtering must treat transaction type (`sale`/`rent`) independently from property classification (`residential`, `commercial`, `stand`, `mine`, `farm`, or `other_land`).

**Why:** A commercial or land listing can be for rent, so using the display/property type alone can place rental listings in the For Sale section and apply the wrong price treatment. The catalogue also needs to target one land category without including the others.

**How to apply:** Use `listingType` for sale/rental filters, section grouping, and rental price labels; use `propertyType` or the display type only for residential/commercial/stand/mine/farm/other-land grouping.

The brochure setup uses three horizontal steps: personnel, sale/rent, and property type. Only the active step expands its editable controls.

**Why:** Separating scope, transaction type, and property type reduces the cognitive load of the setup while keeping every choice editable.

**How to apply:** Keep the live matching summary and Generate Brochure action visible while switching steps, and preserve selections when moving between steps.

The custom-agent picker includes the signed-in user's listings alongside other agents, labeled with the user's name followed by `(My Listings)`.

**Why:** Agents need to combine their own listings with selected colleagues' properties without switching out of the custom selection mode.

**How to apply:** Keep the current user's agent group selectable in the custom picker and distinguish it from other agent groups with the suffix.

Every property entry in a generated brochure should identify its handling agent with the agent's name, email, and phone number when those details are available.

**Why:** A brochure recipient needs a direct contact for the specific listing, not only the agency-wide contact shown on the cover.

**How to apply:** Resolve the property's `agentId` against the user directory in Office and Mobile, and render the contact block on each property entry.

Apply approved brochure branding and layout changes to every renderer used by the product, including the Office print view and the separate Mobile PDF HTML.

**Why:** Updating only one renderer leaves brochures generated from the other app using the old layout, even though both are called brochures.

**How to apply:** When changing a brochure specification, search for all print/PDF HTML generators and keep agency identity, property-page layout, photos, and footer consistent across them.

For Expo mobile brochure PDFs, keep each A4 page within its print box and anchor the footer inside that page.

**Why:** A mobile brochure with a page-height section and a flowing footer produced a separate footer-only page after each listing.

**How to apply:** Use zero print margins, avoid extra page margins, position the footer within the page, and verify the exported PDF page count as well as the HTML preview.

Expo's native print APIs default to US Letter (612 × 792 pt); `@page size: A4` alone does not set the PDF page box. Pass A4 width and height in 72-PPI points to every brochure `printAsync` and `printToFileAsync` call.

**Why:** A 297 mm HTML page overflows the default Letter output, moving the footer onto a separate page.

**How to apply:** Use `width: (210 / 25.4) * 72` and `height: (297 / 25.4) * 72`, keep print margins at zero, and verify the generated PDF page count.

An admin or principal may explicitly link their profile to an active agent in the same branch; desktop “My Listings” then uses that agent's portfolio. Never infer this link from a matching name alone.

**Why:** Admin and agent accounts can be separate profiles for the same person, and name-based matching could expose another agent's listings.

**How to apply:** Validate the stored link against the signed-in user's branch and use only that linked agent ID for the desktop brochure's personal scope.

The brochure cover uses the agency's optional tagline in the introductory text area; when no tagline is configured, that area is omitted rather than replaced with default copy.

**Why:** Agency branding should control the cover message without showing generic platform copy when the field is intentionally blank.

**How to apply:** Trim the stored tagline before rendering and conditionally render the cover description only when it has content.