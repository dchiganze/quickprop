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