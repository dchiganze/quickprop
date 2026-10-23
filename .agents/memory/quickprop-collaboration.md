---
name: QuickProp collaboration
description: Decision and privacy boundary for agent-to-agent collaboration matching.
---

Agencies group branches for administrative management, logos, and team assignment. A user's assigned branch remains the listing-visibility boundary: agents can see their own branch's published listings and another branch's listings only when those listings explicitly opt in to collaboration.

**Why:** Adding an agency parent for administration does not authorize access to sibling-branch inventory; keeping the existing boundary avoids accidental cross-office disclosure.

**How to apply:** Keep discovery and collaboration contact details branch-scoped, and restrict contact details to approved requests. Do not expand access across an agency's branches unless explicitly requested.

Collaboration should work like Hinge: an agent requests to collaborate on another agent's property; the listing agent sees who requested and can accept or decline. Declining must not notify the requester. Only an accepted match sends a match notification to the requesting agent. Both agents gain access to each other's phone numbers after acceptance, not before.

**Why:** The user explicitly specified this collaboration and contact-privacy behaviour.

**How to apply:** Keep request identity visible to the recipient, gate both phone numbers on mutual acceptance at the API boundary, and do not send decline notifications. Whether a declined status should also be hidden in the Sent list is not yet specified; do not assume that silent notifications alone settles that UI choice.