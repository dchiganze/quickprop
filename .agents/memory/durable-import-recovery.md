---
name: Durable portfolio import recovery
description: The restart and retry semantics that keep large agency portfolio imports safe.
---

The database is the source of truth for import progress: a completed file is never reprocessed during automatic recovery, while uploaded, failed, or interrupted files are safe to retry. Worker ownership must be restartable and periodically renewed.

**Why:** An in-process worker disappears during an API restart, and retrying a whole file must not create duplicate draft records or overwrite human corrections.

**How to apply:** Keep file completion and record writes in the same transaction, preserve corrected values and change history during extraction retries, and expose checkpoint timestamps, attempts, progress, and errors to the Office review flow.