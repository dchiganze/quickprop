---
name: QuickProp Brochure Filtering
description: Domain distinction needed when filtering or rendering customised property brochures.
---

Mobile brochure filtering must treat transaction type (`sale`/`rent`) independently from property classification (`residential`, `commercial`, `stand`, `mine`, `farm`, or `other_land`).

**Why:** A commercial or land listing can be for rent, so using the display/property type alone can place rental listings in the For Sale section and apply the wrong price treatment. The catalogue also needs to target one land category without including the others.

**How to apply:** Use `listingType` for sale/rental filters, section grouping, and rental price labels; use `propertyType` or the display type only for residential/commercial/stand/mine/farm/other-land grouping.