---
name: QuickProp Cloud Sync
description: Data ownership and reconciliation rules shared by QuickProp Office and the Agent app.
---

Treat the API-backed PostgreSQL database as the source of truth for listings. Mobile AsyncStorage is a read cache; new listing creates and edits must be saved to the API while online and must never enter an offline listing queue.

**Why:** The user explicitly wants listing flows to be Upload, Draft, or Published, with no visible or internal offline queue for listing writes.

**How to apply:** If offline, keep the listing form open and require reconnection; show Draft or Published only after the API confirms the save. Preserve existing offline synchronization for unrelated work unless the user changes that requirement. Do not clear an existing cloud-backed portfolio when a refresh unexpectedly returns an empty result.

When an agent reconnects, apply only the mobile-edited listing fields to the latest server record; do not block a queued edit just because the record timestamp advanced elsewhere.

**Why:** The user wants Agent and Office edits to sync when internet returns, without losing unrelated changes from the other client.

**How to apply:** Keep field-level updates in the outbox and send them as PATCH data. For legacy conflicts with no saved field list, automatically recover an identifiable status-only change; do not overwrite the full online listing without a deliberate choice.

Keep newly added, optional API sync routes isolated from core portfolio sync so a temporarily older production server cannot block unrelated data.

**Why:** Mobile and API releases can briefly be out of step; a 404 from a new feature endpoint must not stop listings, tasks, or viewings from syncing.

**How to apply:** Guard optional feature sync separately from core API requests, preserve its local cache on failure, and retry when the route is available.

Store listing media and documents in cloud object storage, with only their object paths stored on the listing record.

**Why:** Large files do not belong in relational records and need separately controlled upload and download access.

**How to apply:** Upload via presigned URLs from the API, then create or update the PostgreSQL listing with the resulting durable media paths.

Keep draft listing photos private when fixing missing thumbnails; authenticate media URL resolution rather than making draft objects anonymously readable.

**Why:** Native and browser image elements do not automatically carry the app's bearer session. Direct private-object URLs can therefore fail even while listing API requests succeed.

**How to apply:** Resolve durable media references through the authenticated API and keep expiring read URLs only in a short-lived, account-scoped client cache—not in listing records or the offline portfolio.

Treat explicitly downloaded mobile listings as account-scoped device copies, not server-wide download flags. Revalidate listing access through an authenticated snapshot API, keep pinned media outside the evictable cache, and clear those copies on sign-out.

**Why:** A downloaded marker means the content exists on this device only; explicitly saved photos must remain available offline without bypassing draft-media privacy.

**How to apply:** Keep the offline manifest scoped to the signed-in account, authorize own listings or active agency listings on the server, and never persist expiring signed media URLs.

On mobile listing badges, show only the API-confirmed publication state, never a local sync or pending-publication state.

**Why:** The user wants listing state to be Draft or Published, never queued or waiting-to-sync.

**How to apply:** Derive the badge from the confirmed `status` field. Keep legacy retry handling out of the visible listing state.