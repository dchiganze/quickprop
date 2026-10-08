---
name: QuickProp password-reset email
description: Resend API-key scope and sender-domain verification for admin password-reset mail.
---

QuickProp's admin password-reset email path uses the Resend REST API with `RESEND_API_KEY` and `QUICKPROP_EMAIL_FROM`. Prefer a sending-only key scoped to the sender domain. The readiness check must not call Resend's domains-list endpoint because that endpoint requires full access; a valid sending-only key can be rejected there even though it can send.

**Why:** The Replit-managed Resend app connection in this workspace returned an invalid-key error, while the direct sending-only key was accepted. Resend then separately rejected a message when the sender domain was not verified for the key's account.

**How to apply:** Confirm the sender domain is verified in the same Resend team that issued the key. A safe delivery check can use Resend's `delivered@resend.dev` test address, but get user approval first because Resend counts test sends against quota. The Replit Resend MCP sign-in is separate from the app's transactional-email credential.
