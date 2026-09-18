---
name: QuickProp Sharing
description: Cross-platform image-card and caption behavior for property and catalogue sharing.
---

Web browsers cannot reliably attach a generated image directly to a WhatsApp Web URL.

**Why:** The native mobile share sheet can hand WhatsApp an image and caption together, but desktop browsers may not support file sharing or WhatsApp attachment handoff.

**How to apply:** Generate the image card and caption together; use the Web Share API with a file when supported, otherwise download the card, copy the caption, and open WhatsApp with the caption so the user can attach the downloaded image.

Facebook and LinkedIn browser URL composers cannot carry a local collage image; web sharing must use the browser file-share API first.

**Why:** Their `sharer` URLs accept only a public link, so they render a link preview and discard the locally captured image.

**How to apply:** On web, capture the collage and call `navigator.share({ files, text })` when `navigator.canShare({ files })` supports it; otherwise download the collage, copy the caption, and let the user add the image manually.