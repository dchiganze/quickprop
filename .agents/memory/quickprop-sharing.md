---
name: QuickProp Sharing
description: Cross-platform image-card and caption behavior for property and catalogue sharing.
---

Web browsers cannot reliably attach a generated image directly to a WhatsApp Web URL.

**Why:** The native mobile share sheet can hand WhatsApp an image and caption together, but desktop browsers may not support file sharing or WhatsApp attachment handoff.

**How to apply:** Generate the image card and caption together; use the Web Share API with a file when supported, otherwise download the card, copy the caption, and open WhatsApp with the caption so the user can attach the downloaded image.

For targeted Facebook and LinkedIn buttons on web, bypass the browser file-share API and open the platform composer directly.

**Why:** Their `sharer` URLs accept only a public link, so they cannot import a local collage; the browser file-share API instead opens the Windows/system share panel, which is an unwanted extra screen.

**How to apply:** For Facebook/LinkedIn, download the captured collage, copy the caption, and open the destination URL directly. Keep `navigator.share({ files, text })` for generic share actions where the system chooser is expected.