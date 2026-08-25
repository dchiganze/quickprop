---
name: QuickProp Cloud Sync
description: Data ownership and reconciliation rules shared by QuickProp Office and the Agent app.
---

Treat the API-backed PostgreSQL database as the source of truth for listings and operational data. Treat mobile AsyncStorage as an offline cache and mutation outbox only.

**Why:** Office and Agent must converge on the same portfolio, while Agent still needs to create, edit, and queue work offline.

**How to apply:** Persist mutations locally before syncing them through the API with idempotency keys. Expose pending/error state to the agent and do not clear an existing cloud-backed portfolio when a refresh unexpectedly returns an empty result.

Store listing media and documents in cloud object storage, with only their object paths stored on the listing record.

**Why:** Large files do not belong in relational records and need separately controlled upload and download access.

**How to apply:** Upload via presigned URLs from the API, then create or update the PostgreSQL listing with the resulting durable media paths.