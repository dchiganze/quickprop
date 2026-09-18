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

Crawler-facing share pages must expose server-rendered Open Graph metadata and a public JPEG collage; client-only SPA metadata is not sufficient for Facebook or LinkedIn crawlers.

**Why:** Social crawlers may not execute the marketplace React app, and local browser blobs cannot be fetched by the platforms.

**How to apply:** Keep readable marketplace URLs for captions, but use a public preview URL for targeted social buttons. Let humans redirect to the normal page while crawlers receive `og:title`, `og:description`, and `og:image`.

The published API must be revalidated after each share-preview change; a local public route can still return an authentication response when production is serving an older build.

**Why:** Social crawlers only see the published deployment, not the local workflow, and a stale production API makes an otherwise correct preview link unusable.

**How to apply:** Check the canonical production preview URL with an unauthenticated request after publishing. Require a 200 HTML response with `og:image`, and separately check the referenced JPEG returns 200 `image/jpeg`.