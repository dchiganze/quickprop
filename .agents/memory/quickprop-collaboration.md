---
name: QuickProp collaboration
description: Decision and privacy boundary for agent-to-agent collaboration matching.
---

Agencies group branches for administrative management, logos, and team assignment. A user's assigned branch remains the listing-visibility boundary: agents can see their own branch's published listings and another branch's listings only when those listings explicitly opt in to collaboration.

**Why:** Adding an agency parent for administration does not authorize access to sibling-branch inventory; keeping the existing boundary avoids accidental cross-office disclosure.

**How to apply:** Keep discovery and collaboration contact details branch-scoped, and restrict contact details to approved requests. Do not expand access across an agency's branches unless explicitly requested.

QuickProp Agent's DBT Properties agency view must show drafts from agents in the signed-in user's active agency. My Listings stays limited to the signed-in agent, All of QuickProp stays published-only, and agency draft visibility does not grant cross-branch editing access.

**Why:** The user explicitly confirmed that agents should see drafts across their own agency, but not across agencies.

**How to apply:** Derive the agency and its active branches from the signed-in user's branch. Keep draft visibility within those active branches, preserve My Listings ownership filtering, keep the global feed published-only, and keep edits owner-scoped.

Changing an existing user's assigned branch changes their branch-scoped access. Admin reassignment must be explicitly confirmed, accept only active branches in active agencies, and update the user's branch without silently moving linked listings or import history.

**Why:** Branch membership determines which business records an account can access, so reassignment is an access-control change rather than a cosmetic profile edit.

**How to apply:** Validate branch status and agency status on the server, audit the previous and next assignment, and explain the access impact before confirming.

Administrator access allows assigning a new property to another active agent; ordinary agents remain self-assigned, and the existing agency/branch boundary still applies.

**Why:** The user requested that an agent account with administrator access be able to create listings for other agents.

**How to apply:** Restrict agent selection to administrator-access accounts in Office and mobile, carry the selected agent and branch through mobile offline sync, and enforce assignment authorization on the server.

Collaboration should work like Hinge: an agent requests to collaborate on another agent's property; the listing agent sees who requested and can accept or decline. Declining must not notify the requester. Only an accepted match sends a match notification to the requesting agent. Both agents gain access to each other's phone numbers after acceptance, not before.

**Why:** The user explicitly specified this collaboration and contact-privacy behaviour.

**How to apply:** Keep request identity visible to the recipient, gate both phone numbers on mutual acceptance at the API boundary, and do not send decline notifications. Whether a declined status should also be hidden in the Sent list is not yet specified; do not assume that silent notifications alone settles that UI choice.

An accepted collaboration match creates a durable, private in-app notification and sends a best-effort Expo push notification to the requesting agent. A declined request must never notify the requester.

**Why:** The user asked for a phone notification when a match happens, while preserving the existing private inbox and silent-decline behavior.

**How to apply:** Keep the in-app notification in the same transaction as acceptance, then push only after that transaction commits using an idempotency key. The requester needs an active push token for a lock-screen alert; never include phone numbers in the push.

The default collaboration tab is "Matched" and contains accepted collaborations only. Each match identifies the other agent and their agency, says they can collaborate to close the sale/lease, and offers Call and WhatsApp.

**Why:** The user requested a distinct accepted-match view, with WhatsApp preloading listing information and "Hi x, it's x, let's collaborate to close this deal".

**How to apply:** Resolve the other participant correctly for both listing owners and requesters. The user subsequently asked to remove Explore; do not restore that tab. Demonstration matches are explicitly fictional previews, not real portfolio records or notifications; their contact buttons must not contact anyone.