---
name: QuickProp Sharing
description: Cross-platform image-card and caption behavior for property and catalogue sharing.
---

Web browsers cannot reliably attach a generated image directly to a WhatsApp Web URL.

**Why:** The native mobile share sheet can hand WhatsApp an image and caption together, but desktop browsers may not support file sharing or WhatsApp attachment handoff.

**How to apply:** Generate the image card and caption together; use the Web Share API with a file when supported, otherwise download the card, copy the caption, and open WhatsApp with the caption so the user can attach the downloaded image.