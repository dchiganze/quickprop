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

When a social destination is reached after an async preview check, create the popup window synchronously from the original click and navigate it after the check completes.

**Why:** Browsers can leave a delayed `about:blank` popup empty when `window.open` happens after an awaited request, even though the share action itself succeeds.

**How to apply:** Pre-open a named share window on the click handler, close it on validation failure, and assign the final social URL once the preview check returns.

Meta's general sharing overview mentions quote sharing, but the current Web Share Dialog URL-redirection reference omits `quote`; QuickProp's direct web URL test loads the preview while ignoring the caption.

**Why:** The platform documentation is inconsistent across the general overview and the web dialog reference, and the current Facebook web composer may ignore `quote` even when the preview image loads. App Domains make the public preview usable but do not guarantee caption injection.

**How to apply:** Open `dialog/share` for the preview, copy the caption to the clipboard, and tell the user to paste it into Facebook. Do not promise automatic prefill from URL redirection; a Facebook JS SDK or native SDK experiment must be treated as a separate, unverified path. Direct Page publishing is a separate Graph API flow requiring Page permissions and is not equivalent to personal-profile sharing.

The Facebook Share Dialog requires the Meta app ID and an App Domains entry for the exact public QuickProp hostname; the app-independent `sharer.php` URL is only a fallback.

**Why:** A canonical public QuickProp preview can be reachable and crawler-valid while Meta's app-ID dialog still rejects it with "Can't load URL" when the app configuration does not match.

**How to apply:** Prefer the documented `dialog/share?app_id=...&display=popup&href=...` URL when the configured app ID is available. Copy the caption separately because URL redirection does not accept caption text; retain `sharer.php` as the no-app-ID fallback.

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

Social buttons must use the canonical production preview URL even when the Office app is running in a Replit preview.

**Why:** Replit preview origins such as localhost or `.replit.dev` are not reachable by Facebook and are rejected unless explicitly allowlisted; Meta needs the public QuickProp domain for both allowlisting and crawling.

**How to apply:** Keep local origins for local-only actions, but construct Facebook and LinkedIn preview URLs from `https://www.quickprop.melios.co.zw` and revalidate that public route before opening the composer.

Keep `og:url` set to the metadata share URL, not the redirect destination.

**Why:** Facebook may canonicalize the preview to the destination URL and replace the property card with the generic marketplace page.

**How to apply:** Use the share URL for crawler metadata and a normal-request HTTP redirect for the eventual profile or listing click.

Only public, currently available listings should produce crawler-facing social preview URLs.

**Why:** Draft references can exist in the agent/office database but intentionally return 404 from the public share route; sending those URLs to Facebook produces a domain-only card.

**How to apply:** Gate Facebook and LinkedIn actions on public listing status, and use direct URL sharing on web without downloading a local card image.

Bound property-card preparation before a native social handoff, and wait on the rendered, authorised photo loader rather than separately prefetching raw private media URLs.

**Why:** An unresolved image-prefetch promise can prevent the app chooser from opening at all, leaving a permanent sharing spinner. A property refresh can also replace the data object without triggering another image-load event.

**How to apply:** Keep readiness keyed to photo URI changes, time out preparation with a visible retryable error, and clear pending waiters. Do not apply an automatic fallback timer to an already-open native chooser: that can open a second dialog after the user has begun sharing.

Dismiss QuickProp's iOS sharing modal before presenting the system share panel, and wait for the actual `Modal.onDismiss` event.

**Why:** Image preparation completing does not mean the current native presenter is free. Starting another presentation while the custom modal is still open or animating creates a presentation conflict; a fixed sleep does not reliably establish dismissal.

**How to apply:** Prepare the attachment first, close the app modal, await its dismissal with a bounded failure path, then open the system chooser. A dismissal failure must stop the handoff, not open a second panel later. Validate the external-app handoff on an installed iPhone build; browser previews and ordering tests cannot prove that device behaviour.

For individual property posts, LinkedIn on phones must use the native share sheet with a single listing link, not automatically open its browser composer.

**Why:** The user confirmed Facebook sharing worked in Expo Go while LinkedIn failed with the image-only chooser, then explicitly chose sharing the listing link through the phone's share sheet rather than opening LinkedIn in the browser.

**How to apply:** Share only the public preview URL (iOS URL item, Android text item), copy the caption separately, and await iOS modal dismissal first. Keep the HTTPS composer for web only. Never open a browser automatically after native cancellation. LinkedIn must be installed and enabled in the share sheet; browser screenshots and ordering tests do not prove the external-app handoff works.