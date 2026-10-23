---
name: QuickProp Office bulk imports
description: Durable rules and parser constraints for agency-scoped portfolio imports.
---

Bulk imports must preserve the original source in private object storage, keep every extracted record as a draft, and require an explicit duplicate decision before adding properties to inventory or linking existing properties.

**Why:** Agency files are sensitive and automated matching can otherwise silently overwrite or merge the wrong canonical property.

**How to apply:** Keep source ownership checks, correction history, provenance, and human approval/link decisions in any future import changes.

All newly bulk-imported properties must enter inventory as drafts, even when the source includes photos. At least one photo is required before an agent can explicitly publish a property; uploading a photo does not itself publish it.

**Why:** The user requested that bulk uploads always go into drafts and become publishable only after a photo is uploaded.

**How to apply:** Keep import completion separate from marketplace publication, allow photo-less draft edits, and enforce the photo requirement on the server as well as the publishing controls. Do not change an existing linked property's visibility merely because another import links to it.

Import processing must wait for the Office user to review and explicitly confirm source-column mappings. Preserve the confirmed mapping on retries.

**Why:** The user requires the source "Property" column to map to QuickProp "Title" and processing to wait for confirmation.

**How to apply:** Route initial runs and retries through the mapping review; do not call the process endpoint until the user confirms.

Every imported listing should preserve its title from a mapped or recognized Property/listing-title column; a titleless row must not be publishable. Import duplicate flags require both an exact title and identical numeric price.

**Why:** The user requires titles to load and duplicate flags to appear only for exact title-and-price matches.

**How to apply:** Normalize title aliases before validation, and use exact title-plus-price matching only in bulk imports; do not change fuzzy matching used by other QuickProp flows.

PDF retries must reconcile candidates one-to-one and remove only unmatched, unedited draft rows. Preserve corrected, reviewed, published, or audit-history records.

**Why:** Earlier PDF attempts can leave stale titleless rows beside the latest extraction, inflating the ledger and hiding the current result.

**How to apply:** Use stable unique source locations, match each prior row at most once, and perform stale-draft cleanup transactionally only after the user confirms reprocessing.

When a retry reuses record IDs, refresh the editor draft from the latest server data if the user has not changed that draft locally.

**Why:** The database can contain extracted titles while the mounted review page still shows blank values cached from the earlier version of the same record.

**How to apply:** Track the last server snapshot per record and replace local state only when it still matches that snapshot; preserve unsaved edits.

Duplicate warning cards must follow the import record's active duplicate status, not the presence of stored candidate metadata.

**Why:** Clearing a duplicate decision can leave candidate details attached, which otherwise makes a clear record look like a possible duplicate.

**How to apply:** Show "Possible duplicate" only for the exact title-and-price `possible` status; label human-confirmed links separately.

The pdf-parse package entrypoint can execute its bundled fixture when loaded from the server's ESM bundle; use a Node-safe implementation import or another parser that does not initialize browser canvas globals during API startup.

**Why:** A parser startup side effect prevented the API from listening even when no PDF was being processed.

**How to apply:** Treat document parsers as lazy processing dependencies and verify the API boots before testing extraction.

This QuickProp Office workspace is for DBT Properties. Import access requires an active branch assignment on the signed-in account. New agencies start with one main branch named after its address; administrators can add branches. Multi-branch imports assign rows from matching branch names or addresses, and use the selected main/default branch only when a row has no branch value.

**Why:** Import sessions and published properties are branch-scoped. A fallback is safe only after the account is assigned and the admin chooses a branch for rows that lack source data.

**How to apply:** Keep the import entry point blocked for unassigned accounts. Match source branch values against active branch names/addresses; require manual correction for unknown values, and never replace an unassigned account with an assumed branch.