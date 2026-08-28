---
name: QuickProp Office bulk imports
description: Durable rules and parser constraints for agency-scoped portfolio imports.
---

Bulk imports must preserve the original source in private object storage, keep every extracted record as a draft, and require an explicit duplicate decision before publish can create or link a property.

**Why:** Agency files are sensitive and automated matching can otherwise silently overwrite or merge the wrong canonical property.

**How to apply:** Keep source ownership checks, correction history, provenance, and human publish/link decisions in any future import changes.

The pdf-parse package entrypoint can execute its bundled fixture when loaded from the server's ESM bundle; use a Node-safe implementation import or another parser that does not initialize browser canvas globals during API startup.

**Why:** A parser startup side effect prevented the API from listening even when no PDF was being processed.

**How to apply:** Treat document parsers as lazy processing dependencies and verify the API boots before testing extraction.