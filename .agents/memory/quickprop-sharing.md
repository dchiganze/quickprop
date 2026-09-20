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

Facebook custom caption prefill requires Meta's Share Dialog rather than the public `sharer.php` URL.

**Why:** Facebook ignores custom text parameters on the public sharer endpoint; the Share Dialog accepts a `quote` only when a configured Meta App ID and allowed app domain are used.

**How to apply:** Keep the public sharer as a fallback, and switch to `dialog/share` when the public App ID is injected into Office and the mobile build. Never expose an App Secret in client code.

Crawler-facing share pages must expose server-rendered Open Graph metadata and a public JPEG collage; client-only SPA metadata is not sufficient for Facebook or LinkedIn crawlers.

**Why:** Social crawlers may not execute the marketplace React app, and local browser blobs cannot be fetched by the platforms.

**How to apply:** Keep readable marketplace URLs for captions, but use a public preview URL for targeted social buttons. Let humans redirect to the normal page while crawlers receive `og:title`, `og:description`, and `og:image`.

The published API must be revalidated after each share-preview change; a local public route can still return an authentication response when production is serving an older build.

**Why:** Social crawlers only see the published deployment, not the local workflow, and a stale production API makes an otherwise correct preview link unusable.

**How to apply:** Check the canonical production preview URL with an unauthenticated request after publishing. Require a 200 HTML response with `og:image`, and separately check the referenced JPEG returns 200 `image/jpeg`.

Preview image generation must use dependencies bundled with the API rather than workspace-installed system binaries.

**Why:** The development workflow had ImageMagick available, but the published API runtime did not, so image routes failed while metadata pages still returned 200.

**How to apply:** Treat a 200 preview page as incomplete until its image is fetched from the same production runtime and verified as a valid JPEG.

Version social preview URLs when the image or metadata implementation changes.

**Why:** Facebook and LinkedIn can retain an earlier failed scrape even after the same URL starts returning valid metadata and an image.

**How to apply:** Increment the preview query version in client links and preserve it in `og:url` and `og:image` for the next crawler request.

Social preview URLs should return metadata to crawlers but an HTTP redirect to the intended marketplace destination for normal visitors.

**Why:** Facebook's in-app browser may ignore HTML or JavaScript redirects after a preview card click, making the card appear inert.

**How to apply:** Detect social crawler user agents before the redirect; send crawlers the Open Graph page and send normal requests a 302 to the profile or listing destination.

Keep `og:url` set to the metadata share URL, not the redirect destination.

**Why:** Facebook may canonicalize the preview to the destination URL and replace the property card with the generic marketplace page.

**How to apply:** Use the share URL for crawler metadata and a normal-request HTTP redirect for the eventual profile or listing click.

Only public, currently available listings should produce crawler-facing social preview URLs.

**Why:** Draft references can exist in the agent/office database but intentionally return 404 from the public share route; sending those URLs to Facebook produces a domain-only card.

**How to apply:** Gate Facebook and LinkedIn actions on public listing status, and use direct URL sharing on web without downloading a local card image.