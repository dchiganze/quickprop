---
name: QuickProp Merge Recovery
description: Reliability constraints for reversible property merges and their release checks.
---

Run database queries sequentially inside a single Drizzle transaction rather than with `Promise.all`.

**Why:** A transaction uses one PostgreSQL client; concurrent queries on that client can emit pg deprecation warnings and make recovery checks depend on unsafe query scheduling.

**How to apply:** Keep snapshot reads and ownership-restoration writes ordered within the transaction, especially in property merge and unmerge flows.