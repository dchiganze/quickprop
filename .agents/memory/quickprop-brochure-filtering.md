---
name: QuickProp Brochure Filtering
description: Domain distinction needed when filtering or rendering customised property brochures.
---

Mobile brochure filtering must treat transaction type (`sale`/`rent`) independently from property classification (`residential`, `commercial`, or land).

**Why:** A commercial or land listing can be for rent, so using the display/property type alone can place rental listings in the For Sale section and apply the wrong price treatment.

**How to apply:** Use `listingType` for sale/rental filters, section grouping, and rental price labels; use `propertyType` or the display type only for residential/commercial/land grouping.