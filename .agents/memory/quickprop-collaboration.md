---
name: QuickProp collaboration
description: Decision and privacy boundary for agent-to-agent collaboration matching.
---

Treat a user's branch as the agency boundary for collaboration discovery. Agents can see every published listing in their own branch and only published listings from another branch when that listing explicitly opts in to collaboration.

**Why:** The shared database has branches but no separate agency entity, so treating all users as one agency would leak listings that were intended to stay private across offices.

**How to apply:** Keep collaboration contact details restricted to an approved request. If an agency table is introduced later, migrate the discovery and authorization checks to its membership relationship rather than loosening the branch rule.